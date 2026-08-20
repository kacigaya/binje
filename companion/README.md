# Cast companion

A local helper that lets the b!nje player mirror its Chrome tab to a Cast
receiver. Chrome only exposes tab mirroring through the DevTools Protocol, and a
web page cannot speak that protocol, so this small service sits in between:

```
web app  --http(127.0.0.1)-->  companion  --CDP-->  Chrome  ---->  Cast device
```

It is only needed for receivers that refuse the Google Cast media receiver app.
When the page can cast directly (Google Cast) or over AirPlay, it does, and the
companion is never contacted.

## Running it

```bash
bun run cast:companion
```

The companion listens on `http://127.0.0.1:8747` and talks to Chrome's DevTools
endpoint on port `9222`.

Chrome has to be started with remote debugging enabled. Recent versions refuse
`--remote-debugging-port` when it would attach to the default profile, so pass a
separate profile directory:

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.config/binje-cast-chrome"
```

Cast the page from that Chrome window. The profile is a throwaway one, so your
normal profile, extensions, and cookies are untouched.

## Configuration

| Variable                  | Default                                     | Meaning                              |
| ------------------------- | ------------------------------------------- | ------------------------------------ |
| `BINJE_CAST_PORT`         | `8747`                                      | Port the companion listens on        |
| `BINJE_CHROME_DEBUG_PORT` | `9222`                                      | Chrome's `--remote-debugging-port`   |
| `BINJE_CAST_ORIGINS`      | –                                           | Extra origins allowed to drive it    |

`http://localhost:3000`, `http://127.0.0.1:3000`, and `https://binje.duckdns.org`
are always allowed. If the page is served from another origin, add it to
`BINJE_CAST_ORIGINS` **and** to `NEXT_PUBLIC_CAST_COMPANION_ORIGIN`'s CSP entry in
`next.config.ts`, which reads the companion origin from `lib/tab-cast.ts`.

## API

| Route         | Method | Body / query                | Purpose                        |
| ------------- | ------ | --------------------------- | ------------------------------ |
| `/health`     | GET    | –                           | Liveness plus current session  |
| `/cast/sinks` | GET    | `?tabUrl=`                  | Discovered Cast receivers      |
| `/cast/start` | POST   | `{ sinkName, tabUrl? }`     | `Cast.startTabMirroring`       |
| `/cast/stop`  | POST   | `{ sinkName? }`             | `Cast.stopCasting`             |

## Security

The companion drives a browser, so it is written to be useless to anything but
the app:

- It binds to `127.0.0.1` only. The hostname is a constant, not a setting.
- Every request must carry an `Origin` from the allowlist. Anything else is
  refused before Chrome is contacted.
- Every request must carry `X-Binje-Cast: 1`. A browser cannot attach a custom
  header cross-origin without a preflight, and the preflight is subject to the
  origin check, so this is the CSRF guard.
- `POST` bodies must be JSON, are capped at 4 KB, and are parsed into a fixed
  shape. `sinkName` must match a sink Chrome is currently reporting.
- The API is fixed. No route accepts a CDP method name, and no CDP command is
  built from request data beyond a validated sink name.
- `tabUrl` is a hint, not an instruction. The companion enumerates Chrome's
  targets itself and only ever attaches to a page on an allowed origin.
- Nothing here shells out.

Chrome gates requests from a public page to a loopback address. The companion
answers preflights with `Access-Control-Allow-Private-Network: true`, which is
what current Chrome asks for. Newer builds replace that with a Local Network
Access permission prompt instead; accept it when Chrome shows it.

The DevTools port itself is the wider exposure: anything on the machine that can
reach `127.0.0.1:9222` can drive that Chrome profile. That is why the setup above
uses a dedicated profile rather than your everyday one.

## Layout

| File                 | Role                                                    |
| -------------------- | ------------------------------------------------------- |
| `index.ts`           | Startup, `Bun.serve`, shutdown                          |
| `server.ts`          | HTTP routes, access control, request validation         |
| `cast-controller.ts` | Session lifecycle, sink discovery, mirroring state      |
| `chrome.ts`          | DevTools endpoint lookup and tab selection              |
| `cdp.ts`             | The DevTools Protocol client                            |
| `config.ts`          | Ports and origin allowlist                              |
| `fake-chrome.ts`     | Test double for the DevTools socket                     |
