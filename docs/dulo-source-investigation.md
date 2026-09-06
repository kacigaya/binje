# Dulo playback source investigation

Checked on 2026-09-06 using Dulo's public web player in Chromium. Browser
network capture exposed four playable-source entries per tested title, but
did not expose the upstream provider identities or independent resolver APIs.
No provider integration has been added to b!nje.

## Method

Opened the public site, dismissed its notices, selected each title through the
UI, and started playback. Recorded browser response status, source event-stream
bodies, redirect destinations, and failed requests. No account was used.

The inspected titles were:

| Title | TMDB ID | Selection | Returned entries |
| --- | --- | --- | --- |
| The Shawshank Redemption | 278 | Movie | 3 HLS, 1 DASH |
| The Godfather | 238 | Movie | 3 HLS, 1 DASH |
| Breaking Bad | 1396 | Season 1, episode 1 | 3 HLS, 1 DASH |

This samples both movie and TV playback. It does not enumerate every provider
that Dulo might use for other titles, regions, or server configurations.

## Observed request flow

1. The site bootstraps a browser session with `GET /api/session`.
2. Starting playback calls `POST /api/source` on `https://dulo.gd` with a JSON
   body containing `type`, `tmdbId`, and, for TV, `season` and `episode`.
3. The endpoint returns `text/event-stream`. Observed event types include
   `accepted`, `progress`, `sources`, and `complete`.
4. `sources` events supply URLs and generic display labels. The completion
   event reports numbered attempt positions, outcomes, and counts, without
   provider names.
5. The player tries the supplied media URLs and advances when playback fails.

The live source entries had these fields:

| Label | Type | Quality | Returned host and path shape |
| --- | --- | --- | --- |
| Source 1 | `hls` | `1080p` | `sabrina-stream-proxy.late-haddock.workers.dev/v/<opaque>/index.m3u8` |
| Source 2 | `hls` | `1080p` | Same host and path shape, different opaque value |
| Source 3 | `hls` | `1080p` | Same host and path shape, different opaque value |
| Source 4 | `dash` | Not supplied | `d.dulo.gd/ap1/stream/v3.<opaque>` |

The HLS proxy returned HTTP 302 redirects to `den.dulo.tv`. Chromium then
reported `net::ERR_NAME_NOT_RESOLVED`; a local DNS lookup also failed.
Requests to `d.dulo.gd` failed with `net::ERR_FAILED`. That generic error does
not establish the cause. No successful media playback was verified.

For both sampled movies, attempt positions 2 and 3 succeeded in resolving
entries, position 9 timed out, and the other reported positions were disabled.
For the TV episode, positions 3 and 4 succeeded; positions 1, 2, 5, and 6 were
disabled. These positions are not stable provider identifiers across media
types. A successful resolution means that URLs were returned, not that their
media played successfully.

## Public script evidence

The inspected [main bundle](https://dulo.gd/assets/index-CAXlbSSc.js) implements
the session bootstrap and streamed source request. Its source-control UI text
states that provider names and node routing remain server-side. The public
bundle references authenticated administration endpoints, but those endpoints
were not queried.

The [player bundle](https://dulo.gd/assets/PlayerV2Modal-BuWcCtMe.js) uses a
single generic `source` entry in its movie and TV provider lists. It also
contains label replacements for Torrentio, Premiumize, and Real-Debrid.
Those strings are evidence of client code, not proof that any of those
services supplied the captured streams. Videasy's trailer host also appeared
in browser traffic; trailer requests do not establish a full-movie provider.

## Implications for b!nje

The observed URLs identify Dulo's delivery proxies. They do not provide a
verified mapping to independent movie and TV providers, a reusable lookup
contract, or a complete provider inventory. Opaque URL values were not decoded;
their contents and expiry were not established.

An earlier external API check returned `session_required` without a session
and `forbidden_origin` with a session. Normal in-site browser playback returned
HTTP 200 source responses. The earlier rejection therefore did not mean that
browser network analysis was impossible.

Before implementing independent providers, obtain a verified upstream mapping
and integration contract, or select independently documented providers as an
explicit expansion of scope. Keep the existing Videasy and French-audio paths.
Do not hardcode captured media URLs or treat numbered source labels as provider
names. The current b!nje player uses HLS; DASH entries would also need explicit
player compatibility work.

Session cookies, opaque media URL values, and raw browser profiles are excluded
from this report and from Git.
