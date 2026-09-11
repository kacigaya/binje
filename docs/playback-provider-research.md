# Playback provider research

Checked 2026-09-06. This extends the [Dulo network investigation](./dulo-source-investigation.md)
with independently usable providers. No additional Dulo upstream identity was
confirmed. Public search results and the inspected Dulo adapter in
[masqueradarr](https://github.com/TheBinaryNinja/masqueradarr/blob/main/server/src/sources/adapters/dulo.ts)
did not supply a movie/TV resolver: that adapter handles live TV instead.

## Findings that affect implementation

- [Videasy](https://www.videasy.to/) announces that it and its VidKing mirror
  will close on September 15, 2026. Preserve the existing source as requested,
  but do not count VidKing as independent redundancy.
- VidZee is the strongest native HLS candidate from these checks. Its current
  public player uses `core.vidzee.wtf`, not the older `/api/server` endpoint in
  the [Nuvio adapter](https://github.com/tapframe/NuvioStreamsAddon/blob/master/providers/VidZee.js).
  Omitting the optional `e=1` response-encryption parameter returned plain JSON.
  An English movie resolve, HLS master, variant, and media segment all loaded.
  `ffprobe` identified H.264 video and AAC audio in the segment.
- VidLink returned a `mwVault` source with DASH/HEVC, SRT captions, and
  `requiresProxy: true`. This is a larger integration than adding an HLS URL.
  The sampled DASH manifest returned HTTP 403 in a direct HTTP check.
- The [Nuvio public instance](https://nuviostreams.hayd.uk) redirects to its
  operator's [deprecation notice](https://nuviostreams-is-deprecated.elfhosted.com/).
  Its open-source adapters are research references, not verified hosted services.

## Candidate checks

Statuses describe this environment at the time of the check, not global uptime.
An HTTP 200 page or playlist does not prove successful video playback.

| Candidate | Integration evidence | Observed result | Decision |
| --- | --- | --- | --- |
| Videasy | Existing b!nje resolver; official shutdown notice | Service announces closure September 15 | Preserve existing source |
| [VidKing](https://www.vidking.net/) | Documented movie/TV embeds and progress events | Both sample pages and HLS manifests returned 200; notice identifies it as Videasy's mirror | Do not add as independent provider |
| [VidZee](https://player.vidzee.wtf/) | Public movie/TV player, live resolver and subtitle requests | Both titles returned HLS; English movie segment verified H.264/AAC | Implement native resolver, then verify through b!nje |
| [MovieBox](https://github.com/mesamirh/MovieBox-Tui) | Android app BFF, documented by the open-source TUI client | Signed API answers from the server; movie and TV episodes return DASH manifests behind CloudFront cookies | Implemented as `source=moviebox`, DASH served as HLS by `/api/hls` |
| [VidLink](https://vidlink.pro/) | Documented movie/TV embeds and `PLAYER_EVENT` messages | Pages/API 200; captured movie source is DASH/HEVC; direct MPD check 403 | Candidate requiring format/proxy work; not verified playable |
| [VixSrc](https://vixsrc.to/) | Official indexed embed documentation; [HTML parser reference](https://github.com/tapframe/NuvioStreamsAddon/blob/master/providers/vixsrc.js) | Browser returned Cloudflare 403 | Defer live integration |
| [VidFast](https://vidfast.pro/) | Movie/TV embed service; [independent resolver implementation](https://github.com/sharoon7171/vidfast-pro-stream-resolver) | Browser returned Cloudflare 403 | Defer; third-party resolver not executed or adopted |
| [SuperEmbed](https://www.superembed.stream/) / MultiEmbed | Documented `video_id`, `tmdb`, `s`, `e` iframe parameters | Movie/TV requests reached `streamingnow.mov` verification page, 403; documented `directstream.php` returned 404 | Defer |
| [2Embed](https://www.2embed.cc/) | Official movie/TV embed URL documentation | Both routes navigated to `2embed.skin` detail pages; no video verified | Defer |
| [VidSrc.me](https://www.vidsrc.me/) | Indexed official page announces domain migration | Current page 520; `vidsrc.xyz` DNS failure | Defer; do not treat similarly named clones as mirrors |
| [VidSrc.cc](https://vidsrc.cc/) | Independent host with similar branding | Cloudflare 403 | Defer |
| Embed.su | Known embed hostname | DNS failure | Defer |
| [VidSrc.hair](https://vidsrc.hair/) | Indexed own docs require iframe without sandbox | DNS failure | Defer; sandbox restriction also needs explicit UI evaluation |
| [ezvidapi](https://ezvidapi.com/) | Own site advertises direct HLS and embeds | Homepage 502 | Defer; claims not verified |
| [Torrentio](https://github.com/TheBeastLT/torrentio-scraper) | Open-source Stremio addon | Hosted configuration page 403; source distinguishes torrent results from debrid URLs | Separate account/P2P workflow, not a drop-in HLS source |
| [Premiumize](https://www.premiumize.me/api) | Official authenticated direct-link API | Documentation verified; no account-based playback attempted | Optional user-account integration only |
| [Real-Debrid](https://api.real-debrid.com/) | Official authenticated unrestrict/transcode API | Documentation verified; no account-based playback attempted | Optional user-account integration only |

## VidZee prototype

Observed routes from the public player's network traffic:

- `/streams/languages/movie/{tmdbId}` and `/streams/languages/tv/{tmdbId}/{season}/{episode}`
- `/streams/movie/{tmdbId}?s=v4%3AEnglish`
- `/streams/tv/{tmdbId}/{season}/{episode}?s=v4%3AEnglish`
- `/subs/movie/{tmdbId}` and `/subs/tv/{tmdbId}/{season}/{episode}`

The plain response contained `url`, `language`, and `headers.Referer`. This is
observed application behavior, not a published stable external API contract.
The player also attempted `s=dcloud`; that attempt did not produce a usable
response in the prototype. Do not advertise unverified internal server IDs.

The HLS URL redirected from `i-cdn-0.hutro433fil.com` to
`cdn30092.hutro433fil.com`. Some master responses were labeled `text/html`
despite beginning with `#EXTM3U`. The English movie master listed four
resolutions; the lowest variant contained 1,711 media segments. One segment
was downloaded for codec inspection. Full-length playback was not tested.

Initial browser runs of VidZee's own player fetched manifests and segments but
reported zero decoded frames. Server-side transport and codec checks therefore
do not yet establish browser playback. b!nje must demonstrate advancing video
frames through its own proxy before the integration is described as working.

## MovieBox

Checked 2026-09-11 against the [MovieBox-Tui](https://github.com/mesamirh/MovieBox-Tui)
client (`src/providers/moviebox`). Its other providers do not fit this app:
4KHDHub resolves to MKV/HEVC downloads, BDIX mirrors answer only from
Bangladeshi ISPs, Stremio addons ship without a stream addon, and M3U playlists
are a live-TV feature.

Contract observed live:

- Hosts `api6|api5|api4|api4sg|api3|api6sg.aoneroom.com` and `api.inmoviebox.com`,
  paths under `/wefeed-mobile-bff`.
- Every request carries `x-client-token` (`ts,md5(reverse(ts))`), `x-tr-signature`
  (`ts|2|base64(HMAC-MD5(secret, canonical))`), `x-client-info` (spoofed Android
  device JSON) and the app User-Agent. The canonical string is method, accept,
  content-type, body length, timestamp, body md5 and path with the query sorted
  by key, newline-separated. Without the signature the gateway answers
  `407 Signature invalid`; without `x-client-info`, `400 DeviceId is required`.
  The TUI also spoofs `x-forwarded-for`; requests succeed without it.
- `POST user-api/visitor-login` returns a JWT used as `Authorization: Bearer`.
- `POST subject-api/search/v2` returns one row per upload: dubbed uploads carry a
  bracket tag (`Inception [Hindi]`) and series one row per season (`Breaking Bad S5`),
  all sharing the subject id. Matching strips both and prefers untagged rows.
- `GET subject-api/play-info/v2?subjectId[&se&ep]` returns streams whose `url` is a
  shared placeholder mp4. The playable media is the CloudFront policy inside
  `signCookie`: its `Resource` is a directory holding `index.mpd`, and the three
  `CloudFront-*` cookie pairs must accompany every request beneath it. Segments
  need no Referer or User-Agent.
- The manifest is static, single-period, `SegmentTemplate` + `SegmentTimeline`,
  three HEVC video representations (1080/720/480, Main profile in the sampled
  title) and one AAC audio representation. `/api/hls` translates it into an HLS
  master plus media playlists (`lib/dash-to-hls.ts`) and attaches the cookie to
  segment requests, so hls.js, Safari, expo-video and Cast keep their HLS path.
- Subtitles exist as SRT under `subject-api/resource` + `get-ext-captions`, keyed
  by upload resource id. They are not exposed yet: `<track>` needs WebVTT and no
  converter has been added.

Limits: title matching can pick a remake or homonym (no IMDb id in results);
HEVC playback depends on the device decoder; the app secret is public in the TUI
repository and a rotation upstream breaks the source; signed cookies expire and
the proxy's cookie map is per instance, so stale playback needs a re-resolve.

## Account-based alternatives

[Stremio's stream protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/stream.md)
distinguishes HTTP `url` results from torrent `infoHash` results. The latter
cannot be passed to b!nje's current HLS player. The
[Torrentio implementation](https://github.com/TheBeastLT/torrentio-scraper/blob/master/addon/lib/streamInfo.js)
and its [Premiumize adapter](https://github.com/TheBeastLT/torrentio-scraper/blob/master/addon/moch/premiumize.js)
make that distinction concrete.

Premiumize and Real-Debrid resolve supplied files/links using authenticated
accounts; they are not anonymous TMDB-to-video catalogs. An integration needs
user authorization, content matching, and format validation. Premiumize's
current documentation says its transcode infrastructure is retired and that
`stream_link` is no longer a promise of transcoded browser-compatible media.
No paid account, borrowed credential, or hosted addon configuration was used.

## b!nje changes required

1. Retain Videasy and the existing French source; add an explicit source choice.
2. Give VidZee a bounded resolver and separate cache. Validate returned URLs and
   subtitles before registering hosts. A subtitle outage must not block video.
3. Carry server-validated stream referers through the HLS proxy, redirects, and
   rewritten playlists. Preserve DNS/private-address checks and Cast token rules.
4. Recognize the mislabeled HLS masters and resolve relative playlist links
   against the final redirect URL.
5. Verify movie and TV playback, source switching, subtitle loading, mobile
   contracts, and quality selection. Casting still requires an actual receiver.

No iframe-only candidate is silently substituted into the native player. Public
provider code and captures do not establish Dulo's full provider inventory.
Raw cookies, opaque URLs, and unredacted browser traffic stay outside Git.

Implementation and remaining verification gaps are recorded in
[the validation report](playback-provider-validation.md).
