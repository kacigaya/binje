# Vidcore browser resolver

`scripts/vidcore_resolver.py` runs Vidcore's player in a WebSkrap browser and returns its HLS URL to b!nje. b!nje checks and proxies the stream like any other source.

## Setup

1. Install WebSkrap 3 with Chromium and Xvfb.
2. Put these values in the service's private environment:

   | Variable | Value |
   | --- | --- |
   | `VIDCORE_RESOLVER_TOKEN` | A random ASCII secret with at least 32 characters. |
   | `VIDCORE_RESOLVER_HOST`, `VIDCORE_RESOLVER_PORT` | Optional. The default is `127.0.0.1:3040`. |
   | `GLUETUN_PROXY_URL`, `GLUETUN_PROXY_USER`, `GLUETUN_PROXY_PASSWORD` | Optional browser proxy. Leave unset. |
   | `WEBSKRAP_CHROMIUM_SANDBOX` | Set to `0` only on hosts that block Chromium's sandbox. |

3. Run the script, or install [the systemd unit](../deploy/binje-vidcore-resolver.service).
4. Set `VIDCORE_RESOLVER_URL` and the same `VIDCORE_RESOLVER_TOKEN` in the app's private environment.

Keep the service on a private interface, and let only the app reach it. An app deployment does not update this service. After the script changes, install it again and restart the unit.

## Behavior

- The endpoint accepts a movie ID or a TV episode. Every request needs the bearer secret.
- The browser can reach only Vidcore's own hosts. Media, subtitle searches, and service workers are blocked.
- Two browser slots. A request waits at most one second for a slot, then gets `503`. Each page has ten seconds.
- Each request writes one log line with its result and elapsed time. Logs contain no URLs, media IDs, or error text.

## Checks

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
bun test lib/vidcore.test.ts lib/sources.test.ts lib/stream-check.test.ts
```
