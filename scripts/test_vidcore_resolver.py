import asyncio
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import vidcore_resolver
from vidcore_resolver import Chromium, guard_browser, handler_class, is_playlist, is_provider_request, player_path, resolve, serve, watch_browser


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
    def connection(self):
        return SimpleNamespace(on=Mock(), off=Mock(), send=AsyncMock())

    async def test_devtools_pipe_routes_responses_and_scopes_events(self):
        reader = asyncio.StreamReader()
        writer = Mock()
        chromium = Chromium(writer, reader)
        listener = Mock()
        chromium.on("Network.requestWillBeSent", listener, session_id="player")

        def write(data):
            command = json.loads(data[:-1])
            self.assertTrue(data.endswith(b"\0"))
            self.assertEqual(command["sessionId"], "player")
            for session_id in ("other-page", "player"):
                event = {"method": "Network.requestWillBeSent", "sessionId": session_id,
                         "params": {"request": {"url": "https://cdn.test/a.m3u8"}}}
                reader.feed_data(json.dumps(event).encode() + b"\0")
            reader.feed_data(json.dumps({"id": command["id"], "result": {}}).encode() + b"\0")

        writer.write.side_effect = write
        self.assertEqual(await chromium.send("Network.enable", session_id="player"), {})
        listener.assert_called_once_with({"request": {"url": "https://cdn.test/a.m3u8"}})
        reader.feed_eof()
        await chromium.reader
        with self.assertRaises(ConnectionError):
            await chromium.send("Browser.getVersion")

    async def test_captures_playlist_and_removes_listener(self):
        connection = self.connection()

        async def send(method, *_args, **_kwargs):
            if method == "Target.createTarget":
                return {"targetId": "target-1"}
            if method == "Target.attachToTarget":
                return {"sessionId": "page-1"}
            if method == "Page.navigate":
                connection.on.call_args.args[1]({"request": {"url": "https://cdn.test/master.m3u8"}})
            return {}

        connection.send.side_effect = send
        self.assertEqual(await resolve(connection, "/movie/1"), {"url": "https://cdn.test/master.m3u8"})
        connection.off.assert_called_once_with("Network.requestWillBeSent", session_id="page-1")
        self.assertEqual(connection.send.call_args.args, ("Target.closeTarget", {"targetId": "target-1"}))

    async def test_full_slots_fail_fast_and_queue_time_keeps_page_time(self):
        page_seconds = {"1": 0.8, "3": 0.6}

        async def fake_resolve(_session, path):
            await asyncio.sleep(page_seconds[path.split("/")[2].split("?")[0]])
            return {"url": "https://cdn.test/a.m3u8"}

        def post(media_id):
            connection = http.client.HTTPConnection(*server.server_address, timeout=5)
            try:
                connection.request("POST", "/resolve", json.dumps({"type": "movie", "id": media_id}),
                                   {"Authorization": "Bearer " + "x" * 32})
                response = connection.getresponse()
                return response.status, json.loads(response.read())
            finally:
                connection.close()

        # Request 3 waits 0.5 s for the slot, then needs 0.6 s: over 1 s in total, but its page stays within 1 s.
        with patch.multiple(vidcore_resolver, SLOTS=1, SLOT_WAIT_SECONDS=0.6, TIMEOUT_SECONDS=1, resolve=fake_resolve):
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler_class(asyncio.get_running_loop(), None, "x" * 32))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with self.assertLogs("vidcore_resolver", level="INFO") as logs:
                    first = asyncio.create_task(asyncio.to_thread(post, "1"))
                    await asyncio.sleep(0.05)
                    busy = asyncio.create_task(asyncio.to_thread(post, "2"))
                    await asyncio.sleep(0.25)
                    queued = asyncio.create_task(asyncio.to_thread(post, "3"))
                    self.assertEqual((await busy)[0], 503)
                    self.assertEqual((await first)[0], 200)
                    self.assertEqual(await queued, (200, {"url": "https://cdn.test/a.m3u8"}))
                self.assertEqual(sum("busy" in line for line in logs.output), 1)
                self.assertEqual(sum("resolved in" in line for line in logs.output), 2)
                self.assertFalse(any("cdn.test" in line for line in logs.output))
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    async def test_closes_page_after_navigation_fails(self):
        connection = self.connection()
        connection.send.side_effect = [{"targetId": "target-1"}, {"sessionId": "page-1"}, {}, {}, {}, TimeoutError, {}]
        with self.assertRaises(TimeoutError):
            await resolve(connection, "/movie/1")
        self.assertEqual(connection.send.call_args.args, ("Target.closeTarget", {"targetId": "target-1"}))
        connection.off.assert_called_once()

    async def test_browser_guard_blocks_media_and_offsite_requests(self):
        connection = self.connection()
        await guard_browser(connection, "proxy-user", "proxy-password")
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
        connection = self.connection()
        await guard_browser(connection, "proxy-user", "proxy-password")
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
        connection = self.connection()
        connection.send.side_effect = ConnectionError("secret-token")
        with self.assertLogs("vidcore_resolver", level="ERROR") as logs:
            with self.assertRaisesRegex(RuntimeError, "Browser connection failed"):
                await watch_browser(connection)
        self.assertIn("ConnectionError", logs.output[0])
        self.assertNotIn("secret-token", logs.output[0])

    async def test_browser_failure_stops_http_server_and_exits_for_systemd_restart(self):
        connection = self.connection()
        connection.send.side_effect = ConnectionError
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_class(asyncio.get_running_loop(), connection, "x" * 32))
        with self.assertLogs("vidcore_resolver", level="ERROR"):
            with self.assertRaisesRegex(RuntimeError, "Browser connection failed"):
                await asyncio.wait_for(serve(connection, server), timeout=2)
        self.assertEqual(server.fileno(), -1)


    async def test_idle_http_client_does_not_block_browser_recovery(self):
        connection = self.connection()
        crash = asyncio.Event()
        accepted = threading.Event()

        async def fail_when_signaled(*_args, **_kwargs):
            await crash.wait()
            raise ConnectionError

        connection.send.side_effect = fail_when_signaled
        base = handler_class(asyncio.get_running_loop(), connection, "x" * 32)

        class Handler(base):
            def setup(self):
                super().setup()
                accepted.set()

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        task = asyncio.create_task(serve(connection, server))
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
