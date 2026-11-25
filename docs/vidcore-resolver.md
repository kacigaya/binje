# Vidcore resolver

## Browser-free worker

The isolated worker starts sending HLS candidates as soon as it finds them. The app checks each playlist and a media segment. It closes the connection after the first stream passes. Each worker keeps compiled player scripts in memory while serving requests and exits after five idle minutes. The service starts a new worker on the next request.

1. On Linux, make Bun, Node.js 26, and Bubblewrap available. Put Node.js 26 on the unit's system PATH, outside user homes. The worker needs unprivileged user namespaces and a Bubblewrap build that can run without setuid.
2. Install the repo dependencies with `bun install --frozen-lockfile`. Install the worker dependencies with `npm ci --ignore-scripts --prefix scripts/vidcore-worker`.
3. Build the service with `bun build --target=node --packages=external scripts/vidcore-worker/service.ts --outfile build/vidcore-service.mjs`.
4. Set the resolver host, port, and token in a private environment file. The worker unit reads `/etc/binje-vidcore-worker/environment`.
5. Run `node build/vidcore-service.mjs`, or install the [worker systemd unit](../deploy/binje-vidcore-worker.service). If you keep the Chromium resolver running for rollback, use a separate port.
6. Set the app's `VIDCORE_RESOLVER_URL` and `VIDCORE_RESOLVER_TOKEN` to match the selected service.

Before switching production, run the worker on a separate private port. Compare it with the Chromium resolver using the same movie and episode requests. Check successful playback, resolve latency, and peak service memory with overlapping requests. Switch the app to the worker only after these checks pass. Stop the Chromium service to reclaim its memory. If playback degrades, start Chromium again and restore the previous resolver endpoint.

Bubblewrap runs the player code without host network access or service credentials. The service forwards HTTPS requests only to Vidcore and accepts relayed replies up to 4 MiB, large enough for the player's biggest script chunk. The app uses its existing public-network checks for playlists and media segments. Run the service under a dedicated account and expose it only to the app.

The service extracts one stream at a time and lets one other request wait up to six seconds. Requests that exceed this limit receive HTTP 503 so the app can try its other providers. Queueing and extraction share a 12-second budget. If Vidcore returns HTTP 429, the worker stops extraction and pauses new work for the upstream `Retry-After` interval, or 30 seconds when the provider gives no usable interval.

The player adapter derives from [x8rr/movies at bf57ffd](https://github.com/x8rr/movies/blob/bf57ffd/src/vidcore.js) under its [MIT license](../scripts/vidcore-worker/LICENSE). Vidcore can change its player code, so verify both movie and episode resolution before switching services.

## Chromium resolver

`scripts/vidcore_resolver.py` runs Vidcore's player in Chromium and captures the first HLS playlist request through the DevTools pipe. b!nje checks and proxies the stream like any other source. Vidcore's embed handles the source lookup.

### Setup

1. Set up Python 3.11 or later and Chromium. On a Linux host without a display, use `xvfb-run` from Xvfb with `xauth`.
2. Put these values in the service's private environment:

   | Variable | Value |
   | --- | --- |
   | `VIDCORE_RESOLVER_TOKEN` | A random ASCII secret with at least 32 characters. |
   | `VIDCORE_RESOLVER_HOST`, `VIDCORE_RESOLVER_PORT` | Optional. The default is `127.0.0.1:3040`. |
   | `VIDCORE_CHROMIUM_PATH` | Optional. The default is `/usr/bin/chromium`. |
   | `VIDCORE_CHROMIUM_SANDBOX` | Set to `0` only on an isolated host that blocks Chromium's sandbox. |
   | `GLUETUN_PROXY_URL`, `GLUETUN_PROXY_USER`, `GLUETUN_PROXY_PASSWORD` | Optional browser proxy. Leave unset. |

3. Run `xvfb-run -a python3 scripts/vidcore_resolver.py`, or install [the systemd unit](../deploy/binje-vidcore-resolver.service).
4. Set `VIDCORE_RESOLVER_URL` and the same `VIDCORE_RESOLVER_TOKEN` in the app's private environment.

Keep the service on a private interface, and let only the app reach it. An app deployment does not update this service. When upgrading from the WebSkrap version, install the script and unit together. If Chromium lives in a home directory, expose its full installation directory with a read-only systemd bind mount and set `VIDCORE_CHROMIUM_PATH` to the mounted executable. Replace `WEBSKRAP_CHROMIUM_SANDBOX` with `VIDCORE_CHROMIUM_SANDBOX` if the old service needed that setting. Reload systemd before restarting the service.

### Behavior

- The endpoint accepts a movie ID or a TV episode. Every request needs the bearer secret.
- The browser can reach only Vidcore's own hosts. Media, subtitle searches, and service workers are blocked.
- Two browser slots. A request waits at most one second for a slot, then gets `503`. Each page has ten seconds.
- Each request writes one log line with its result and elapsed time. Logs contain no URLs, media IDs, or error text.

## Checks

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
bun test lib/vidcore.test.ts lib/sources.test.ts lib/stream-check.test.ts
```
