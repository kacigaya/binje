"""Resolve Vidcore through Chromium's DevTools pipe."""

import asyncio
import hmac
import json
import logging
import os
import re
import time
from collections.abc import Callable
from contextlib import asynccontextmanager, suppress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from tempfile import TemporaryDirectory
from typing import TypedDict
from urllib.parse import urlsplit

TIMEOUT_SECONDS = 10
SLOT_WAIT_SECONDS = 1
SLOTS = 2
PROVIDER_HOSTS = {"vidcore.net", "vidcore.io"}
LOGGER = logging.getLogger(__name__)


class Busy(Exception):
    pass


class ResolveResult(TypedDict):
    url: str


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


class Chromium:
    def __init__(self, writer: asyncio.StreamWriter, reader: asyncio.StreamReader):
        self.writer = writer
        self.sequence = 0
        self.pending: dict[int, asyncio.Future] = {}
        self.listeners: dict[tuple[str, str | None], Callable] = {}
        self.reader = asyncio.create_task(self.read_messages(reader))

    async def read_messages(self, reader: asyncio.StreamReader) -> None:
        try:
            while True:
                message = json.loads((await reader.readuntil(b"\0"))[:-1])
                if "id" in message:
                    future = self.pending.get(message["id"])
                    if future is not None and not future.done():
                        if "error" in message:
                            future.set_exception(RuntimeError("Chromium command failed."))
                        else:
                            future.set_result(message["result"])
                else:
                    listener = self.listeners.get((message["method"], message.get("sessionId")))
                    if listener is not None:
                        listener(message["params"])
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, ValueError):
            pass
        finally:
            for future in self.pending.values():
                if not future.done():
                    future.set_exception(ConnectionError("Chromium pipe closed."))

    async def send(self, method: str, params: dict | None = None, *, session_id: str | None = None,
                   timeout_s: float = 3) -> dict:
        if self.reader.done():
            raise ConnectionError("Chromium pipe closed.")
        self.sequence += 1
        request_id = self.sequence
        future = asyncio.get_running_loop().create_future()
        self.pending[request_id] = future
        message = {"id": request_id, "method": method, "params": params or {}}
        if session_id is not None:
            message["sessionId"] = session_id
        try:
            self.writer.write(json.dumps(message).encode() + b"\0")
            return await asyncio.wait_for(future, timeout_s)
        finally:
            self.pending.pop(request_id)

    def on(self, method: str, listener: Callable, *, session_id: str | None = None) -> None:
        self.listeners[method, session_id] = listener

    def off(self, method: str, *, session_id: str | None = None) -> None:
        del self.listeners[method, session_id]


@asynccontextmanager
async def launch_chromium(path: str, sandbox: bool, proxy: str | None):
    with TemporaryDirectory(prefix="binje-chromium-", ignore_cleanup_errors=True) as profile:
        flags = [
            "--remote-debugging-pipe",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-blink-features=AutomationControlled",
            "--disable-field-trial-config",
            "--disable-quic",
            f"--user-data-dir={profile}",
        ]
        if not sandbox:
            flags.append("--no-sandbox")
        if proxy:
            flags.append(f"--proxy-server={proxy}")
        browser_env = dict(os.environ)
        for name in ("VIDCORE_RESOLVER_TOKEN", "GLUETUN_PROXY_USER", "GLUETUN_PROXY_PASSWORD"):
            browser_env.pop(name, None)
        process = await asyncio.create_subprocess_exec(
            "/bin/sh", "-c", 'exec "$@" 3<&0 4>&1 </dev/null >/dev/null',
            "chromium", path, *flags, "about:blank", env=browser_env,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=2**20,
        )
        chromium = Chromium(process.stdin, process.stdout)
        try:
            await chromium.send("Browser.getVersion", timeout_s=10)
            yield chromium
        finally:
            if process.returncode is None:
                with suppress(ConnectionError, RuntimeError, TimeoutError):
                    await chromium.send("Browser.close", timeout_s=1)
                try:
                    await asyncio.wait_for(process.wait(), 3)
                except TimeoutError:
                    with suppress(ProcessLookupError):
                        process.kill()
                    await process.wait()
            chromium.reader.cancel()
            with suppress(asyncio.CancelledError):
                await chromium.reader
            process.stdin.close()


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
    try:
        parsed = urlsplit(url)
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and not parsed.username
            and not parsed.password
            and parsed.path.endswith(".m3u8")
        )
    except ValueError:
        return False


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


async def resolve(connection: Chromium, path: str) -> ResolveResult:
    target = await connection.send("Target.createTarget", {"url": "about:blank"})
    target_id = target["targetId"]
    session_id = None
    playlist: asyncio.Future[str] = asyncio.get_running_loop().create_future()

    def capture_request(event: RequestEvent) -> None:
        url = event["request"]["url"]
        if is_playlist(url) and not playlist.done():
            playlist.set_result(url)

    try:
        session = await connection.send("Target.attachToTarget", {"targetId": target_id, "flatten": True})
        session_id = session["sessionId"]
        connection.on("Network.requestWillBeSent", capture_request, session_id=session_id)
        await connection.send("Network.enable", session_id=session_id)
        await connection.send("Network.setBypassServiceWorker", {"bypass": True}, session_id=session_id)
        await connection.send("Page.addScriptToEvaluateOnNewDocument", {
            "source": "if (navigator.serviceWorker) navigator.serviceWorker.register = "
                      "() => Promise.reject(new DOMException('Service workers blocked.', 'NotAllowedError'));",
        }, session_id=session_id)
        navigation = await connection.send("Page.navigate", {"url": "https://vidcore.net" + path},
                                           session_id=session_id, timeout_s=TIMEOUT_SECONDS - 1)
        if navigation.get("errorText"):
            raise RuntimeError("Vidcore navigation failed.")
        return {"url": await playlist}
    finally:
        if session_id is not None:
            connection.off("Network.requestWillBeSent", session_id=session_id)
        await connection.send("Target.closeTarget", {"targetId": target_id})


async def guard_browser(connection: Chromium, username: str, password: str) -> None:
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


async def watch_browser(connection: Chromium) -> None:
    while True:
        try:
            await connection.send("Browser.getVersion", timeout_s=3)
        except Exception as error:
            LOGGER.error("Browser health check failed (%s); restarting resolver.", type(error).__name__)
            raise RuntimeError("Browser connection failed.") from None
        await asyncio.sleep(2)


async def serve(connection: Chromium, server: ThreadingHTTPServer) -> None:
    worker = asyncio.create_task(asyncio.to_thread(server.serve_forever))
    watcher = asyncio.create_task(watch_browser(connection))
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


def handler_class(loop: asyncio.AbstractEventLoop, connection: Chromium, token: str) -> type[BaseHTTPRequestHandler]:
    slots = asyncio.Semaphore(SLOTS)

    async def bounded_resolve(path: str) -> ResolveResult:
        try:
            async with asyncio.timeout(SLOT_WAIT_SECONDS):
                await slots.acquire()
        except TimeoutError:
            raise Busy from None
        try:
            async with asyncio.timeout(TIMEOUT_SECONDS):
                return await resolve(connection, path)
        finally:
            slots.release()

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
            started = time.monotonic()
            future = asyncio.run_coroutine_threadsafe(bounded_resolve(path), loop)
            try:
                result = future.result(SLOT_WAIT_SECONDS + TIMEOUT_SECONDS + 1)
            except Busy:
                LOGGER.warning("Vidcore request busy after %.1fs.", time.monotonic() - started)
                return self.reply(503, {"error": "Vidcore resolver is busy."})
            except Exception as error:
                future.cancel()
                LOGGER.warning("Vidcore request failed (%s) after %.1fs.", type(error).__name__, time.monotonic() - started)
                return self.reply(502, {"error": "Vidcore is unavailable."})
            LOGGER.info("Vidcore request resolved in %.1fs.", time.monotonic() - started)
            self.reply(200, result)

    return Handler


async def main():
    token = os.environ["VIDCORE_RESOLVER_TOKEN"]
    if len(token) < 32 or not token.isascii():
        raise ValueError("VIDCORE_RESOLVER_TOKEN needs at least 32 ASCII characters.")
    proxy = os.environ.get("GLUETUN_PROXY_URL")
    if proxy and urlsplit(proxy).scheme not in ("http", "https"):
        raise ValueError("GLUETUN_PROXY_URL must be an HTTP proxy.")
    path = os.environ.get("VIDCORE_CHROMIUM_PATH", "/usr/bin/chromium")
    sandbox = os.environ.get("VIDCORE_CHROMIUM_SANDBOX") != "0"
    async with launch_chromium(path, sandbox, proxy) as connection:
        await guard_browser(connection, os.environ.get("GLUETUN_PROXY_USER", ""), os.environ.get("GLUETUN_PROXY_PASSWORD", ""))
        server = ThreadingHTTPServer(
            (os.environ.get("VIDCORE_RESOLVER_HOST", "127.0.0.1"), int(os.environ.get("VIDCORE_RESOLVER_PORT", "3040"))),
            handler_class(asyncio.get_running_loop(), connection, token),
        )
        LOGGER.info("Vidcore resolver ready.")
        await serve(connection, server)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        asyncio.run(main())
    except Exception as error:
        LOGGER.error("Resolver stopped (%s).", type(error).__name__)
        raise SystemExit(1) from None
