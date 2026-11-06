import asyncio
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from vidcore_resolver import guard_browser, handler_class, is_playlist, is_provider_request, player_path, resolve, serve, watch_browser


class MediaTests(unittest.TestCase):
    def test_movie_and_episode_paths(self):
        self.assertEqual(player_path({"type": "movie", "id": "969681"}), "/movie/969681?autoPlay=true")
        self.assertEqual(player_path({"type": "tv", "id": 42, "season": "2", "episode": "3"}), "/tv/42/2/3?autoPlay=true")

    def test_rejects_paths_and_invalid_coordinates(self):
        for params in [None, {}, {"type": "movie", "id": "1/../../admin"}, {"type": "movie", "id": True},
                       {"type": "tv", "id": "1", "season": "0", "episode": "1"},
                       {"type": "tv", "id": "1", "season": "1", "episode": "1?url=http://localhost"}]:
            with self.subTest(params=params), self.assertRaises(ValueError):
                player_path(params)

    def test_limits_browser_requests_to_provider_assets(self):
        self.assertTrue(is_provider_request("https://vidcore.io/_next/chunk.js", "script"))
        for url in ["http://vidcore.io/", "https://vidcore.io:444/", "https://vidcore.io.evil.test/",
                    "https://user:pass@vidcore.io/", "http://127.0.0.1/admin", "https://vidcore.io/wyzie"]:
            self.assertFalse(is_provider_request(url, "fetch"), url)
        self.assertFalse(is_provider_request("https://vidcore.io/movie.mp4", "media"))

    def test_accepts_only_https_hls_candidates(self):
        self.assertTrue(is_playlist("https://cdn.test/master.m3u8?token=x"))
        for url in ["http://cdn.test/x.m3u8", "https://cdn.test/movie.mp4", "https://user:pass@cdn.test/x.m3u8"]:
            self.assertFalse(is_playlist(url), url)


class BrowserTests(unittest.IsolatedAsyncioTestCase):
    def session(self):
        connection = SimpleNamespace(on=Mock(), off=Mock(), send=AsyncMock())
        page = SimpleNamespace(connection=connection, session_id="page-1", goto=AsyncMock())
        session = SimpleNamespace(new_page=AsyncMock(return_value=page), close_page=AsyncMock(),
                                  browser=SimpleNamespace(connection=connection))
        return session, page, connection

    async def test_captures_playlist_and_removes_listener(self):
        session, page, connection = self.session()

        async def navigate(*_args, **_kwargs):
            connection.on.call_args.args[1]({"request": {"url": "https://cdn.test/master.m3u8"}})

        page.goto.side_effect = navigate
        self.assertEqual(await resolve(session, "/movie/1"), {"url": "https://cdn.test/master.m3u8"})
        connection.off.assert_called_once_with("Network.requestWillBeSent", connection.on.call_args.args[1], session_id="page-1")
        session.close_page.assert_awaited_once_with(page)

    async def test_closes_page_after_navigation_fails(self):
        session, page, connection = self.session()
        page.goto.side_effect = TimeoutError
        with self.assertRaises(TimeoutError):
            await resolve(session, "/movie/1")
        session.close_page.assert_awaited_once_with(page)
        connection.off.assert_called_once()

    async def test_browser_guard_blocks_media_and_offsite_requests(self):
        session, _, connection = self.session()
        await guard_browser(session, "proxy-user", "proxy-password")
        handlers = {call.args[0]: call.args[1] for call in connection.on.call_args_list}
        request = handlers["Fetch.requestPaused"]
        cases = [
            ("https://vidcore.io/chunk.js", "Script", "Fetch.continueRequest"),
            ("https://vidcore.io/movie.mp4", "Media", "Fetch.failRequest"),
            ("https://vidcore.io/master.m3u8", "XHR", "Fetch.failRequest"),
            ("https://cdn.test/master.m3u8", "XHR", "Fetch.failRequest"),
            ("http://127.0.0.1/admin", "Document", "Fetch.failRequest"),
            ("https://vidcore.io/wyzie", "Fetch", "Fetch.failRequest"),
        ]
        for url, kind, method in cases:
            with self.subTest(url=url):
                request({"requestId": "1", "request": {"url": url}, "resourceType": kind})
                await asyncio.sleep(0)
                self.assertEqual(connection.send.call_args.args[0], method)

    async def test_proxy_credentials_never_answer_site_challenges(self):
        session, _, connection = self.session()
        await guard_browser(session, "proxy-user", "proxy-password")
        handlers = {call.args[0]: call.args[1] for call in connection.on.call_args_list}
        auth = handlers["Fetch.authRequired"]
        for source in ["Server", "Proxy"]:
            auth({"requestId": "1", "authChallenge": {"source": source}})
            await asyncio.sleep(0)
            answer = connection.send.call_args.args[1]["authChallengeResponse"]
            expected = {"response": "Default"} if source == "Server" else {
                "response": "ProvideCredentials", "username": "proxy-user", "password": "proxy-password"}
            self.assertEqual(answer, expected)

    async def test_health_check_logs_failure_without_sensitive_error_text(self):
        session, _, connection = self.session()
        connection.send.side_effect = ConnectionError("secret-token")
        with self.assertLogs("vidcore_resolver", level="ERROR") as logs:
            with self.assertRaisesRegex(RuntimeError, "Browser connection failed"):
                await watch_browser(session)
        self.assertIn("ConnectionError", logs.output[0])
        self.assertNotIn("secret-token", logs.output[0])

    async def test_browser_failure_stops_http_server_and_exits_for_systemd_restart(self):
        session, _, connection = self.session()
        connection.send.side_effect = ConnectionError
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_class(asyncio.get_running_loop(), session, "x" * 32))
        with self.assertLogs("vidcore_resolver", level="ERROR"):
            with self.assertRaisesRegex(RuntimeError, "Browser connection failed"):
                await asyncio.wait_for(serve(session, server), timeout=2)
        self.assertEqual(server.fileno(), -1)


    async def test_idle_http_client_does_not_block_browser_recovery(self):
        session, _, connection = self.session()
        crash = asyncio.Event()
        accepted = threading.Event()

        async def fail_when_signaled(*_args, **_kwargs):
            await crash.wait()
            raise ConnectionError

        connection.send.side_effect = fail_when_signaled
        base = handler_class(asyncio.get_running_loop(), session, "x" * 32)

        class Handler(base):
            def setup(self):
                super().setup()
                accepted.set()

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        task = asyncio.create_task(serve(session, server))
        reader, writer = await asyncio.open_connection(*server.server_address)
        try:
            writer.write(b"POST /resolve HTTP/1.1\r\nHost:")
            await writer.drain()
            self.assertTrue(await asyncio.to_thread(accepted.wait, 1))
            crash.set()
            with self.assertLogs("vidcore_resolver", level="ERROR"):
                with self.assertRaisesRegex(RuntimeError, "Browser connection failed"):
                    await asyncio.wait_for(task, timeout=2)
            self.assertEqual(server.fileno(), -1)
            writer.write(b" localhost\r\n\r\n")
            await writer.drain()
            await asyncio.wait_for(reader.read(), timeout=1)
        finally:
            writer.close()
            await writer.wait_closed()
            if not task.done():
                crash.set()
                with self.assertRaises(RuntimeError):
                    await task


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loop = asyncio.new_event_loop()
        cls.token = "test-token-" + "x" * 32
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_class(cls.loop, None, cls.token))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.loop.close()

    def request(self, path, params, authorized=True):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=2)
        headers = {"Content-Type": "application/json"}
        if authorized:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            connection.request("POST", path, json.dumps(params), headers)
            response = connection.getresponse()
            response.read()
            return response.status
        finally:
            connection.close()

    def test_rejects_requests_without_bearer_secret(self):
        self.assertEqual(self.request("/resolve", {"type": "movie", "id": "1"}, authorized=False), 401)

    def test_rejects_arbitrary_urls_and_invalid_media_before_browser_work(self):
        self.assertEqual(self.request("/resolve", {"url": "http://127.0.0.1/admin"}), 400)
        self.assertEqual(self.request("/resolve", {"type": "tv", "id": "1", "season": 0, "episode": 1}), 400)
        self.assertEqual(self.request("/fetch", {"type": "movie", "id": "1"}), 404)


if __name__ == "__main__":
    unittest.main()
