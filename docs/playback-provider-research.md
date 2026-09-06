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
