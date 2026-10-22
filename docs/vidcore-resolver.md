# Vidcore browser resolver

Vidcore runs rotating request code in its player. `scripts/vidcore_resolver.py` runs that player with the installed WebSkrap runtime. Chromium uses Gluetun's authenticated HTTP proxy and a virtual display. It returns one HLS URL to b!nje.

The service does not download media. b!nje checks the returned URL, probes a playlist and a middle segment, then uses `/api/hls` for playback. This keeps the existing private-network checks and host allowlist. Media requests use the app server's direct connection.

## Setup

1. Use a host with WebSkrap, Patchright Chromium, and Xvfb installed. This host was tested with WebSkrap 2.13.0 and `/home/ubuntu/.local/venvs/webskrap/bin/python`.
2. Put these values in the browser service's private environment:

   | Variable | Value |
   | --- | --- |
   | `GLUETUN_PROXY_URL` | Existing Gluetun HTTP proxy, such as `http://10.89.0.13:8888` on this host. |
   | `GLUETUN_PROXY_USER` | Existing proxy user. |
   | `GLUETUN_PROXY_PASSWORD` | Existing proxy password. |
   | `VIDCORE_RESOLVER_TOKEN` | A random ASCII secret with at least 32 characters. Use the same value in b!nje. |
   | `WEBSKRAP_CHROMIUM_SANDBOX` | Set to `0` only on this host, which blocks Chromium's sandbox. |

3. Start the service from the repository root:

   ```bash
   /home/ubuntu/.local/venvs/webskrap/bin/python scripts/vidcore_resolver.py
   ```

4. Set `VIDCORE_RESOLVER_URL=http://127.0.0.1:3040` and the matching `VIDCORE_RESOLVER_TOKEN` in b!nje's private runtime environment.
5. Restart the app through its normal deployment workflow when ready to use the integration.

The service binds to `127.0.0.1:3040` by default. `VIDCORE_RESOLVER_HOST` and `VIDCORE_RESOLVER_PORT` can change that address. A container cannot reach the host through its own loopback address. For a container app, use a private interface reachable from that container and restrict access to the app. Keep the service off public interfaces. The existing b!nje Docker image does not contain the browser runtime.

## Limits

The endpoint accepts only movie IDs or TV IDs with season and episode numbers. Every request needs the bearer secret. Browser traffic can reach only the two Vidcore hosts. Other hosts, media downloads, subtitle searches, and service workers are blocked. Browser requests use a ten-second deadline and at most two pages at once. The app gives browser resolution and CDN probes one shared thirteen-second deadline. It caches successful resolves for five minutes.

The resolver uses Vidcore's default stream. It does not try every server in Vidcore's menu. For TMDB 969681, the default stream advertised a 3840×1600 rendition. A separate entry named “Premiere 4K” returned 404 during the same check.

If a future CDN binds media to the VPN IP, the direct media probe will reject it and b!nje will use another source. Add VPN media routing only after such a stream is verified. Do not remove the private-network checks to make that stream work.

## Checks

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
bun test lib/vidcore.test.ts lib/sources.test.ts lib/stream-check.test.ts
```
