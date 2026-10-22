# Playback providers

b!nje supports Vidcore, Vidsu, Vidme and Vidru. Each server is a source in `lib/sources.ts`. The server resolves a source to one HLS stream. The browser then plays the stream through `/api/hls`.

Checked on 2026-10-22 with TMDB 969681 (movie) and TMDB 213562 S1E1 (TV).

## Sources

| Source | Server | Resolver | How it resolves |
| --- | --- | --- | --- |
| `vidcore` | Vidcore AdFree | `lib/vidcore.ts` | Asks the local WebSkrap browser service to run Vidcore through Gluetun. See [setup](vidcore-resolver.md). |
| `vidsu` | Vidsu AdFree | `lib/vidsu.ts` | Asks three JSON APIs by TMDB id: Vidrock (`themoviebox.uk`), Xpass (`freakyniki.elaxo.lol`) and Flix2Watch. |
| `vidme` | Vidme AdFree | `lib/vidme.ts` | Reads a signed token from the vidzen.fun watch page, then asks each server (Mars, Jupiter, Mercury and others) for its streams. |
| `vidru` | Vidru AdFree | `lib/vidru.ts` | Follows ythd.org to a vidsrc.sh player page. Decrypts the stream list with the WebAssembly module that the API sends. Stamps each URL with its host's `/generate.php` token. |

Vidsu and Vidru played both test titles to the end. Vidme played the movie. For the episode, Vidme had only a Mercury preview, so `/api/sources` left it out.

## Rules for every resolver

Playback starts with Vidcore while availability checks run. If it fails, the player tries Vidsu, Vidme, then Vidru. Once the checks finish, both web and mobile choose the source with the highest advertised quality. Equal quality keeps that same preference order. A running lower-quality source does not block a switch to a better source.

1. Accept HLS only. The player cannot load MP4 or DASH, so resolvers drop them.
2. Probe each candidate with `probeManifest` and return the first one that plays. The probe rejects finished streams under two minutes. It also starts to read one segment in the middle of the stream.
3. Keep upstream headers on the server. A resolver returns a `referer`, and the proxy sends it to that host.
4. Fail with an error. `/api/sources` then leaves the source out, and the player tries the next one.

## Provider notes

- **Vidsu:** Xpass streams play only through the API's signed proxy URL, with the Referer `https://player-4aq.pages.dev/`. Flix2Watch returns HLS for episodes but MP4 for films. Vidsu's fourth API, Molvin, is switched off in its own player.
- **Vidsu, Vidrock Nova:** Each segment is a 1×1 PNG. The transport stream sits in a private `tsDa` chunk, and `lib/transport-stream.ts` extracts it. The CDN sends a 90-second clip to non-browser User-Agents, so test it with a browser User-Agent.
- **Vidme:** Every stream sits under `https://vidzen.fun/api/stream/` and needs the Referer `https://vidzen.fun/`. Proxima is not in the server list: it returned nothing for the movie and HEVC DASH for the episode. Mercury can point to vidzy.cc, which serves only the first nine segments. The middle-segment probe rejects it.
- **Vidru:** The API token and the host tokens are bound to the server's IP address. A Cloudflare Turnstile check gates only the player page, not the API. The WebAssembly module gets no imports, so it can only compute.
- **Vidcore:** Its page redirects from vidcore.net to vidcore.io. The browser service uses Gluetun's authenticated HTTP proxy and a virtual display. It captures the default server's HLS URL. The app then probes and proxies media with its existing public-network checks. On 2026-10-22, TMDB 969681 advertised 3840×1600 HLS. Both its playlist and a middle segment loaded without the VPN. This cropped frame ranks and displays as 2160p.

Vidcore is left out of the availability response when the browser service is not configured, fails, or returns an unplayable stream. The other sources remain available.
