# Playback provider validation

## Videasy.ws (2026-10-11)

Added `source=videasyws` (`lib/videasyws.ts`) as the first and initial source on
web and mobile. player.videasy.ws wraps a vidsrc.sh player in two iframe pages:

1. `vs_src.php` returns the player host URL with a short-lived `vs` token.
2. That landing page names the player page, which carries a single-use
   `api_token` for `data.vidsrc.sh/api.php?…&stream_urls`.
3. `stream_urls` is base64 nonce||ChaCha20 ciphertext. The API names a
   WebAssembly decryptor that rotates every five minutes.
4. Each stream host's `/generate.php` issues a JWT bound to the server's /24,
   valid about four hours, appended as `?token=`.

This reverses the earlier rejection of vidsrc.sh below: the decryptor now runs
server-side. Safeguards: the module must declare no imports, so it cannot reach
the network, filesystem or host; its download is capped at 1 MB; one compiled
module is cached per rotation window; decrypted entries must be http(s) URLs.
Remaining risk: a hostile or broken module can still spin the CPU during a
resolve. The player page's Turnstile gate is client-side only; the stream API
does not check it, and enforcing it would break this source. Host tokens are
cached for an hour because `generate.php` answers 429 when called often. The
CDNs accept only the player host as Origin, so that host is the stream's
Referer.

Verified locally:

- Live resolves for The Prodigy (532671, no other source except Vidrock), Fight
  Club (550) and Game of Thrones S1E2 (1399) took 0.6 to 1 second.
- `/api/sources` for The Prodigy listed `videasyws` and `vidrock`.
- Headless Chromium on `/fr/watch/532671`: "Videasy.ws · VO" selected, every
  `/api/hls` request answered 200, the 640px rendition played and Auto quality
  was offered.

Not verified: subtitles (the API returned none), Safari, devices and Cast.

## Cine4K (2026-10-12)

Added `source=cine4k` (`lib/cine4k.ts`), second after Videasy.ws, for movies
only; TV pickers leave it out. Found through FMHY's 4K list: Rive's "Mirage"
server proxies `cine4k.mpddash.workers.dev/movie/{tmdbId}.m3u8`, which needs
no key or token. Its master lists 3840x2160 H.264 (`avc1.640033`, about
16 Mbit/s), 1080p, 720p and 480p, in fMP4 segments on rotating hosts.

The Worker answers 403 to any Referer or Origin. The proxy now treats an empty
pinned referer as "send none"; child hosts accept either.

Other FMHY 4K sites were not added: Willow and the P-Stream forks (Cinecat,
Basement, Aether…) take 4K from FebBox with user-submitted `ui` login tokens,
and Rive's "Vanguard" (4K HEVC HDR, movies and TV) is reachable only through
Rive's API with a per-title key computed in its client.

Verified locally: Dune: Part Two, Inception and Fight Club masters list 4K.
On the watch page the picker offered Auto/2160p/1080p/720p/480p and every
`/api/hls` request, including 12-16 MB 4K segments, answered 200. The headless
Chromium here (4 cores, no GPU) kept rendering 720p after 2160p was chosen, so
4K decoding is not verified. Every 4K viewer pulls about 7 GB per film through
the proxy.

## Every source in the picker (2026-10-11)

Web and mobile pickers list every source again. The probe still orders them
and picks the first one to play; sources it left out, or that failed on the
device, are dimmed with "Unavailable" and sorted last instead of hidden. Picking
one clears its failure and tries it; another failure falls back to the source
that was playing. Shared order: `lib/source-menu.ts` (web) and `sourceMenu` in
`apps/mobile/src/features/player/resolveStream.ts`.

## Additional native sources and availability filter (2026-10-05)

Added six resolvers found by inspecting cine.su and 2embed.cc, plus
`/api/sources`, which resolves every provider for a title in parallel and lists
only those whose manifest loads (15-second deadline per source, cached two
minutes). Players show only listed sources, start VidZee before the list
arrives, and drop any source that then fails to resolve or play on the device.

| Source | Resolver | Notes |
| --- | --- | --- |
| Vidnest | `lib/vidnest.ts` | `new.vidnest.fun/<backend>/…` JSON, base64 over a shuffled alphabet; seven backends tried in order |
| Vsrc / Videm | `lib/vsrc.ts` | Same player on vidsrc.buzz and videm.xyz; `api.php?a=play` mints a stream bound to the minting User-Agent |
| 2Embed | `lib/twoembed.ts` | StreamHG file named on the 2Embed page; host read from `swish.js`; packed player script lists HLS variants |
| MoviesAPI | `lib/moviesapi.ts` | `/api/vidora/v1/…` with the `x-player-key` constant read from the player bundle; AES-128 HLS |
| Vidrock | `lib/vidrock.ts` | 02pcembed (Vidlux's backend) JSON; its relay URLs are unwrapped so playback uses b!nje's proxy |

Proxy changes: hosts can pin a User-Agent next to the Referer; playlists are
recognised by content (`.txt`, `text/plain`, `application/javascript`);
segments labelled as images or text are served as `video/mp2t`, with a leading
PNG stripped. Upstream HTML is still never served. The SSRF guard moved to
`lib/safe-fetch.ts` and also covers resolver playability checks.

Verified locally:

- Spider-Man: Brand New Day (969681) listed VidZee, MovieBox, Vidnest, Vsrc,
  Videm, 2Embed and MoviesAPI. Lanterns S1E1 (95350) listed MovieBox, Vidnest,
  Vsrc, Videm, 2Embed, MoviesAPI and Vidrock. Videasy (seed outage) and VF (no
  French release) were hidden.
- For every listed source, master, variant, key (MoviesAPI) and first segment
  returned HTTP 200 through `/api/hls`. `ffprobe` identified H.264/AAC in the
  unwrapped Vsrc, Vidnest and Vidrock segments.
- Headless Chromium: the movie selector listed exactly the seven sources and
  switched to Vsrc. On Lanterns, VidZee failed to resolve and MovieBox (HEVC,
  undecodable in that Chromium) failed to play; both were dropped and Vidnest
  started. Switching to Vidrock loaded its stream.

Not added:

| Candidate | Reason |
| --- | --- |
| Vidcore / Vcr, Vidfast | No stream request observable from a headless browser, even after clicks |
| vidsrc.sh, vsembed, VidApi (vaplayer.ru) | Stream URLs encrypted by a WASM ChaCha20 module that rotates every five minutes; executing it server-side was rejected. Vidnest's `nextgencloudfabric` backend covers the same upstream. Superseded on 2026-10-11: vidsrc.sh is now reached through Videasy.ws |
| VidLink | WASM-encrypted API serving MovieBox's HEVC files, already a source |
| Peachify | Cloudflare challenge |
| Vidsync | Origin unreachable (Cloudflare 523) |
| cine.su Glendale | Grants issued only after a Cloudflare Turnstile check |
| Vidlux | Same 02pcembed backend as the Vidrock source |

Limits: providers change hosts, keys and response shapes often, and each
resolver fails closed (the source disappears from the list). Availability
probing costs one resolve per provider per title every two minutes;
`/api/sources` has its own rate limit of 20 per minute per IP.

## Provider outage follow-up (2026-09-21)

- Videasy's seed endpoint timed out or returned a server error during repeated
  live checks. Web and mobile players now start with VidZee; Videasy remains in
  both source selectors.
- MovieBox replaced its CloudFront policy cookie with an `Edge-Cache-Cookie`
  containing a signed, encoded CDN path. The resolver now accepts both formats.
- Inception resolved through MovieBox, translated from DASH to HLS, and returned
  a 1,024-byte ranged media response with HTTP 206 through `/api/hls`.
- The local Chromium fetched VidZee playlists and H.264/AAC segments. It could
  not decode them because that Chromium build lacks H.264 MSE support.

## MovieBox (2026-09-11)

Implemented `source=moviebox` (`lib/moviebox.ts`), path-scoped upstream cookies in
`lib/hls-hosts.ts`, and DASH-to-HLS translation for `.mpd` targets in `/api/hls`
(`lib/dash-to-hls.ts`). Web and mobile source selectors list "MovieBox · EN".
No dependency was added.

Verified locally:

- `bun run test`, `bun run lint`, TypeScript, `bun run mobile:test`,
  `bun run mobile:typecheck` and `bun run mobile:lint` pass.
- `/api/resolve?source=moviebox` for Inception (27205), Breaking Bad S1E1 and
  S2E3 (1396) and Dark S1E1 (70523) returned the expected `index.mpd` URLs in
  about one second; the undubbed subject was chosen although MovieBox lists the
  Hindi upload first. `source=unknown` still answers 400.
- `/api/hls?url=<mpd>` returned an HLS master with an audio group and 1080/720/480
  variants; `rep=0` returned a 1,480-segment VOD playlist with `EXT-X-MAP`. The init
  and first segment came back HTTP 200 through the proxy with the scoped cookie,
  and `ffprobe` identified HEVC Main 1920x1080 in the concatenated bytes.
- Headless Chromium (Playwright): selecting "MovieBox · EN" on the watch page
  issued the MovieBox resolve, loaded the master, chose the 1080p variant and audio
  group, fetched init and media segments, parsed a 2h28m duration and listed
  Auto/1080p/720p/480p in the quality control. Switching back to another source
  still works.

Not verified:

- Decoded frames. The installed Chromium reports no MSE support for HEVC or H.264,
  so no source, including the existing ones, renders video here. Playback needs a
  browser or device with an HEVC decoder.
- Safari, physical iOS/Android devices and Cast receivers.
- Videasy's default resolve returned 502 during these checks (its seed request
  fails upstream); this is independent of the change.

## VidZee (2026-09-06)

## Implemented

- Added independent VidZee English v4 resolution for movie and TV requests.
- Added VidZee alongside the initial Videasy default and existing French
  resolver. VidZee became the initial source on 2026-09-21 after a Videasy
  upstream outage.
- Added source selection to the web player and native mobile controls. Selection
  lasts for the mounted player; it is not saved between visits.
- Preserved the native HLS player, subtitles, quality discovery and Cast paths.
  VidZee does not supply fixed-quality `sources`, so native mobile uses its
  adaptive master rather than adding manual quality choices.
- The HLS proxy inherits server-owned Referer headers, follows checked redirects,
  resolves relative links against the final URL, and recognizes HLS masters
  mislabeled as HTML. Invalid HTML becomes a JSON error, not a same-origin page.
- Client resolve results expire after one minute. Retry bypasses the client cache.

These are independent integrations. Dulo's hidden provider inventory remains
unidentified; this branch does not implement “all Dulo sources.” See
[the network investigation](dulo-source-investigation.md) and
[the provider comparison](playback-provider-research.md).

## Verification and limits

- Web/API: 81 tests pass, including provider dispatch, TV coordinates, malformed
  URLs, optional subtitles, redirected manifests, inherited Referer, Cast token
  propagation, rejected private-network redirects and retry cache behavior.
- Mobile: 38 tests pass; TypeScript and Expo lint pass.
- Web: ESLint, TypeScript and production build pass.
- Next dev MCP: no compilation issues, config errors or session errors reported.
- Browser: selected VidZee from the existing-source default, observed its distinct
  resolver request, opened the source menu with a keyboard, and inspected the
  control at 375px width. Error states leave the source control usable.
- Breaking Bad S1E1: live resolver, proxied master, media playlist and MPEG-TS
  segment returned HTTP 200. FFmpeg decoded a frame from the proxied segment.
- Both installed Chromium builds report H.264 and AAC unsupported. Browser video
  frames remain zero, including for existing Videasy streams. End-to-end visual
  playback is therefore **not verified** in this environment.
- Earlier Shawshank research obtained HLS and decoded H.264/AAC transport. Later
  live movie requests for Shawshank and The Godfather returned provider HTTP 502.
  Movie availability is not established by the successful TV transport check.
- No physical mobile device, Safari, or Cast receiver was tested. Subtitle
  filtering is tested; actual rendered subtitle synchronization is not verified.
- No dependencies or paid credentials were added. Source availability depends
  on upstream services. Videasy's announced September 15 shutdown remains a
  separate risk documented in the provider comparison.

## Review

Reviewed changed code and surrounding resolver, cache, player and proxy paths
locally. Fixed stale client retry results and isolated upstream HTML error pages.
An external model review was not used: permission to disclose repository code to
that provider was not established.

The OSV scan queried 1,304 exact public dependency entries from `bun.lock`.
It flagged nine installed package/version entries below. These predate this
branch; no dependency upgrades were made. OSV matches published versions and does
not account for the existing local `image-size` patch. The findings therefore
need a separate applicability review before choosing upgrades.

| Installed package | Advisory / aliases | Supplied severity | Reported affected ranges |
| --- | --- | --- | --- |
| `@humanfs/node@0.16.7` | [GHSA-p498-v437-472g](https://osv.dev/vulnerability/GHSA-p498-v437-472g); No CVE alias supplied | CVSS_V4: CVSS:4.0/AV:L/AC:L/AT:P/PR:N/UI:P/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N | introduced 0 → fixed 0.16.8 |
| `@xmldom/xmldom@0.8.13` | [GHSA-6gmq-8vp8-gcm6](https://osv.dev/vulnerability/GHSA-6gmq-8vp8-gcm6); CVE-2026-83610 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N | introduced 0.7.0 → fixed 0.8.15; introduced 0.9.0 → fixed 0.9.12 |
| `browserslist@4.28.2` | [GHSA-73wf-gq98-2v4g](https://osv.dev/vulnerability/GHSA-73wf-gq98-2v4g); CVE-2026-73088 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H | introduced 0 → fixed 4.28.7 |
| `browserslist@4.28.2` | [GHSA-c83g-rgw3-j3cx](https://osv.dev/vulnerability/GHSA-c83g-rgw3-j3cx); CVE-2026-73089 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H | introduced 0 → fixed 4.28.7 |
| `decode-uri-component@0.2.2` | [GHSA-vcc3-ghjq-m6fr](https://osv.dev/vulnerability/GHSA-vcc3-ghjq-m6fr); CVE-2026-45822 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:U/S:N/AU:Y/R:U/V:D/RE:M/U:Amber | introduced 0 → fixed 0.5.0 |
| `fast-uri@3.1.5` | [GHSA-5jgf-p345-68v8](https://osv.dev/vulnerability/GHSA-5jgf-p345-68v8); CVE-2026-75931 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.4.2 → fixed 2.4.5; introduced 3.1.3 → fixed 3.1.6; introduced 4.0.1 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-f65p-4m7j-42xc](https://osv.dev/vulnerability/GHSA-f65p-4m7j-42xc); CVE-2026-75975 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.3.1 → fixed 2.4.5; introduced 3.0.0 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-fph4-wmhf-6fwf](https://osv.dev/vulnerability/GHSA-fph4-wmhf-6fwf); CVE-2026-75899 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.4.1 → fixed 2.4.5; introduced 3.1.2 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-jqff-g426-hqxp](https://osv.dev/vulnerability/GHSA-jqff-g426-hqxp); CVE-2026-76172 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.3.1 → fixed 2.4.5; introduced 3.0.0 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `image-size@1.2.1` | [GHSA-5p2g-fcmc-qvqq](https://osv.dev/vulnerability/GHSA-5p2g-fcmc-qvqq); CVE-2025-71329 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N | No fix supplied |
| `image-size@1.2.1` | [GHSA-w3rx-r6r6-pgpr](https://osv.dev/vulnerability/GHSA-w3rx-r6r6-pgpr); CVE-2025-71330 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:X/CR:X/IR:X/AR:X/MAV:X/MAC:X/MAT:X/MPR:X/MUI:X/MVC:X/MVI:X/MVA:X/MSC:X/MSI:X/MSA:X/S:X/AU:X/R:X/V:X/RE:X/U:X | No fix supplied |
| `postcss-selector-parser@7.1.1` | [GHSA-w9m9-85wc-3x92](https://osv.dev/vulnerability/GHSA-w9m9-85wc-3x92); CVE-2026-9358 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N/E:P | introduced 6.1.0 → fixed 6.1.3; introduced 7.1.0 → fixed 7.1.3 |
| `qs@6.15.3` | [GHSA-4mjr-xmp4-gh2g](https://osv.dev/vulnerability/GHSA-4mjr-xmp4-gh2g); CVE-2026-82417 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N | introduced 2.2.5 → fixed 6.16.0 |
| `qs@6.15.3` | [GHSA-x5fp-wj9c-mxmx](https://osv.dev/vulnerability/GHSA-x5fp-wj9c-mxmx); CVE-2026-82562 | CVSS_V3: CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N | introduced 6.14.2 → fixed 6.16.0 |
| `@xmldom/xmldom@0.9.10` | [GHSA-6gmq-8vp8-gcm6](https://osv.dev/vulnerability/GHSA-6gmq-8vp8-gcm6); CVE-2026-83610 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N | introduced 0.7.0 → fixed 0.8.15; introduced 0.9.0 → fixed 0.9.12 |
