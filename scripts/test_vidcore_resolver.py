import asyncio
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import AsyncMock

from vidcore_resolver import handler_class, is_playlist, is_provider_request, player_path, resolve


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
    async def test_captures_playlist_without_downloading_media_and_closes_page(self):
        page = SimpleNamespace(route=AsyncMock(), close=AsyncMock())
        route = SimpleNamespace(request=SimpleNamespace(url="https://cdn.test/master.m3u8", resource_type="xhr"), abort=AsyncMock())

        async def navigate(*_args, **_kwargs):
            await page.route.call_args.args[1](route)

        page.goto = AsyncMock(side_effect=navigate)
        session = SimpleNamespace(context=SimpleNamespace(new_page=AsyncMock(return_value=page)))
        self.assertEqual(await resolve(session, "/movie/1?autoPlay=true"), {"url": "https://cdn.test/master.m3u8"})
        route.abort.assert_awaited_once()
        page.close.assert_awaited_once()

    async def test_closes_page_after_navigation_fails(self):
        page = SimpleNamespace(route=AsyncMock(), close=AsyncMock(), goto=AsyncMock(side_effect=TimeoutError))
        session = SimpleNamespace(context=SimpleNamespace(new_page=AsyncMock(return_value=page)))
        with self.assertRaises(TimeoutError):
            await resolve(session, "/movie/1")
        page.close.assert_awaited_once()


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
