"""Resolve Vidcore in the installed WebSkrap browser through Gluetun."""

import asyncio
import hmac
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from patchright.async_api import Route
    from webskrap.client import WebSkrapSession

TIMEOUT_SECONDS = 10
PROVIDER_HOSTS = {"vidcore.net", "vidcore.io"}


def player_path(params: object) -> str:
    if not isinstance(params, dict) or params.get("type") not in ("movie", "tv"):
        raise ValueError("Invalid media type.")
    if not re.fullmatch(r"[1-9][0-9]{0,11}", str(params.get("id", ""))):
        raise ValueError("Invalid media ID.")
    path = f"/{params['type']}/{params['id']}"
    if params["type"] == "tv":
        for key in ("season", "episode"):
            if not re.fullmatch(r"[1-9][0-9]{0,4}", str(params.get(key, ""))):
                raise ValueError("Invalid episode coordinates.")
            path += f"/{params[key]}"
    return path + "?autoPlay=true"


def is_playlist(url: str) -> bool:
    parsed = urlsplit(url)
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and not parsed.username
        and not parsed.password
        and parsed.path.endswith(".m3u8")
    )


def is_provider_request(url: str, resource_type: str) -> bool:
    try:
        target = urlsplit(url)
        return (
            target.scheme == "https"
            and target.hostname in PROVIDER_HOSTS
            and target.port in (None, 443)
            and not target.username
            and not target.password
            and resource_type != "media"
            and target.path != "/wyzie"
        )
    except ValueError:
        return False


async def resolve(session: "WebSkrapSession", path: str) -> dict[str, str]:
    page = await session.context.new_page()
    playlist = asyncio.get_running_loop().create_future()

    async def route_request(route: "Route") -> None:
        request = route.request
        if is_playlist(request.url):
            if not playlist.done():
                playlist.set_result(request.url)
            await route.abort()
        elif is_provider_request(request.url, request.resource_type):
            await route.continue_()
        else:
            await route.abort()

    try:
        # Only provider assets reach the network. The app probes captured media URLs with its SSRF checks.
        await page.route("**/*", route_request)
        await page.goto("https://vidcore.net" + path, wait_until="domcontentloaded", timeout=9000)
        return {"url": await playlist}
    finally:
        await page.close()


def handler_class(loop: asyncio.AbstractEventLoop, session: "WebSkrapSession", token: str) -> type[BaseHTTPRequestHandler]:
    slots = asyncio.Semaphore(2)

    async def bounded_resolve(path: str) -> dict[str, str]:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async with slots:
                return await resolve(session, path)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, status, data):
            payload = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            self.connection.settimeout(5)
            if not hmac.compare_digest(self.headers.get("Authorization", "").encode(), f"Bearer {token}".encode()):
                return self.reply(401, {"error": "Unauthorized."})
            if self.path != "/resolve":
                return self.reply(404, {"error": "Not found."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1024 or self.headers.get("Transfer-Encoding"):
                    raise ValueError("Invalid body size.")
                path = player_path(json.loads(self.rfile.read(length)))
            except (ValueError, OSError):
                return self.reply(400, {"error": "Invalid media request."})
            future = asyncio.run_coroutine_threadsafe(bounded_resolve(path), loop)
            try:
                result = future.result(TIMEOUT_SECONDS + 1)
            except Exception:
                future.cancel()
                return self.reply(502, {"error": "Vidcore is unavailable."})
            self.reply(200, result)

    return Handler


async def main():
    from webskrap import SessionConfig, WebSkrapClient
    from webskrap.models import ProxyConfig

    token = os.environ["VIDCORE_RESOLVER_TOKEN"]
    if len(token) < 32 or not token.isascii():
        raise ValueError("VIDCORE_RESOLVER_TOKEN needs at least 32 ASCII characters.")
    proxy = os.environ["GLUETUN_PROXY_URL"]
    if urlsplit(proxy).scheme not in ("http", "https"):
        raise ValueError("GLUETUN_PROXY_URL must be an HTTP proxy.")
    config = SessionConfig(
        driver="patchright",
        channel="chromium",
        virtual_display=True,
        service_workers="block",
        chromium_sandbox=os.environ.get("WEBSKRAP_CHROMIUM_SANDBOX") != "0",
        proxy=ProxyConfig(
            server=proxy,
            username=os.environ.get("GLUETUN_PROXY_USER"),
            password=os.environ.get("GLUETUN_PROXY_PASSWORD"),
        ),
        webrtc_ip_handling_policy="disable_non_proxied_udp",
    )
    async with WebSkrapClient() as client:
        session = await client.session("vidcore", config=config)

        async def guard_request(route: "Route") -> None:
            if is_provider_request(route.request.url, route.request.resource_type):
                await route.continue_()
            else:
                await route.abort()

        # Context routing also covers popups. Service workers cannot bypass these rules.
        await session.context.route("**/*", guard_request)
        server = ThreadingHTTPServer(
            (os.environ.get("VIDCORE_RESOLVER_HOST", "127.0.0.1"), int(os.environ.get("VIDCORE_RESOLVER_PORT", "3040"))),
            handler_class(asyncio.get_running_loop(), session, token),
        )
        try:
            await asyncio.to_thread(server.serve_forever)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    asyncio.run(main())
