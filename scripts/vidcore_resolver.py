"""Resolve Vidcore in the installed WebSkrap browser through Gluetun."""

import asyncio
import hmac
import json
import logging
import os
import re
from contextlib import suppress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TYPE_CHECKING, TypedDict
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from webskrap.client import WebSkrapSession

TIMEOUT_SECONDS = 10
PROVIDER_HOSTS = {"vidcore.net", "vidcore.io"}
LOGGER = logging.getLogger(__name__)


class RequestData(TypedDict):
    url: str


class RequestEvent(TypedDict):
    requestId: str
    request: RequestData
    resourceType: str


class AuthChallenge(TypedDict):
    source: str


class AuthEvent(TypedDict):
    requestId: str
    authChallenge: AuthChallenge


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
            and resource_type.lower() != "media"
            and target.path != "/wyzie"
        )
    except ValueError:
        return False


async def resolve(session: "WebSkrapSession", path: str) -> dict[str, str]:
    page = await session.new_page()
    playlist = asyncio.get_running_loop().create_future()

    def capture_request(event: RequestEvent) -> None:
        url = event["request"]["url"]
        if is_playlist(url) and not playlist.done():
            playlist.set_result(url)

    try:
        page.connection.on("Network.requestWillBeSent", capture_request, session_id=page.session_id)
        await page.goto("https://vidcore.net" + path, wait_until="domcontentloaded", timeout_s=9)
        return {"url": await playlist}
    finally:
        page.connection.off("Network.requestWillBeSent", capture_request, session_id=page.session_id)
        await session.close_page(page)


async def guard_browser(session: "WebSkrapSession", username: str, password: str) -> None:
    connection = session.browser.connection
    tasks: set[asyncio.Task[None]] = set()

    async def reply(method: str, params: dict[str, object]) -> None:
        try:
            await connection.send(method, params)
        except Exception as error:
            LOGGER.warning("Browser request control failed (%s).", type(error).__name__)

    def spawn(method: str, params: dict[str, object]) -> None:
        task = asyncio.create_task(reply(method, params))
        tasks.add(task)
        task.add_done_callback(tasks.discard)

    def request(event: RequestEvent) -> None:
        url = event["request"]["url"]
        params = {"requestId": event["requestId"]}
        if not is_playlist(url) and is_provider_request(url, event["resourceType"]):
            spawn("Fetch.continueRequest", params)
        else:
            spawn("Fetch.failRequest", {**params, "errorReason": "BlockedByClient"})

    def authenticate(event: AuthEvent) -> None:
        # Proxy credentials must never reach a website's HTTP authentication challenge.
        answer = {"response": "Default"}
        if event["authChallenge"].get("source") == "Proxy":
            answer = {"response": "ProvideCredentials", "username": username, "password": password}
        spawn("Fetch.continueWithAuth", {"requestId": event["requestId"], "authChallengeResponse": answer})

    connection.on("Fetch.requestPaused", request)
    connection.on("Fetch.authRequired", authenticate)
    # Browser-level interception also covers popups, frames, and workers.
    await connection.send("Fetch.enable", {"patterns": [{"urlPattern": "*"}], "handleAuthRequests": True})


async def watch_browser(session: "WebSkrapSession") -> None:
    while True:
        try:
            await session.browser.connection.send("Browser.getVersion", timeout_s=3)
        except Exception as error:
            LOGGER.error("Browser health check failed (%s); restarting resolver.", type(error).__name__)
            raise RuntimeError("Browser connection failed.") from None
        await asyncio.sleep(2)


async def serve(session: "WebSkrapSession", server: ThreadingHTTPServer) -> None:
    worker = asyncio.create_task(asyncio.to_thread(server.serve_forever))
    watcher = asyncio.create_task(watch_browser(session))
    try:
        done, _ = await asyncio.wait((worker, watcher), return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    finally:
        await asyncio.to_thread(server.shutdown)
        await worker
        await asyncio.to_thread(server.server_close)
        watcher.cancel()
        with suppress(asyncio.CancelledError):
            await watcher


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
            except Exception as error:
                future.cancel()
                LOGGER.warning("Vidcore request failed (%s).", type(error).__name__)
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
        channel="chromium",
        virtual_display=True,
        service_workers="block",
        chromium_sandbox=os.environ.get("WEBSKRAP_CHROMIUM_SANDBOX") != "0",
        proxy=ProxyConfig(
            server=proxy,
        ),
        webrtc_ip_handling_policy="disable_non_proxied_udp",
    )
    async with WebSkrapClient() as client:
        session = await client.session("vidcore", config=config)

        await guard_browser(session, os.environ.get("GLUETUN_PROXY_USER", ""), os.environ.get("GLUETUN_PROXY_PASSWORD", ""))
        server = ThreadingHTTPServer(
            (os.environ.get("VIDCORE_RESOLVER_HOST", "127.0.0.1"), int(os.environ.get("VIDCORE_RESOLVER_PORT", "3040"))),
            handler_class(asyncio.get_running_loop(), session, token),
        )
        LOGGER.info("Vidcore resolver ready.")
        await serve(session, server)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        asyncio.run(main())
    except Exception as error:
        LOGGER.error("Resolver stopped (%s).", type(error).__name__)
        raise SystemExit(1) from None
