# Playback providers

b!nje plays the servers that [Nightflix](https://nightflix.bz/) offers. Each server is a source in `lib/sources.ts`. The server resolves a source to one HLS stream. The browser then plays the stream through `/api/hls`.

Checked on 2026-10-22 with TMDB 969681 (movie) and TMDB 213562 S1E1 (TV).

## Sources

| Source | Nightflix name | Resolver | How it resolves |
| --- | --- | --- | --- |
| `vidsu` | Vidsu AdFree | `lib/vidsu.ts` | Asks three JSON APIs by TMDB id: Vidrock (`themoviebox.uk`), Xpass (`freakyniki.elaxo.lol`) and Flix2Watch. |
| `vidme` | Vidme AdFree | `lib/vidme.ts` | Reads a signed token from the vidzen.fun watch page, then asks each server (Mars, Jupiter, Mercury and others) for its streams. |
| `vidru` | Vidru AdFree | `lib/vidru.ts` | Follows ythd.org to a vidsrc.sh player page. Decrypts the stream list with the WebAssembly module that the API sends. Stamps each URL with its host's `/generate.php` token. |

All three sources played both test titles.

## Rules for every resolver

1. Accept HLS only. The player cannot load MP4 or DASH, so resolvers drop them.
2. Probe each candidate with `probeManifest` and return the first one that plays.
3. Keep upstream headers on the server. A resolver returns a `referer`, and the proxy sends it to that host.
4. Fail with an error. `/api/sources` then leaves the source out, and the player tries the next one.

## Provider notes

- **Vidsu:** Xpass streams play only through the API's signed proxy URL, with the Referer `https://player-4aq.pages.dev/`. Flix2Watch returns HLS for episodes but MP4 for films. Vidsu's fourth API, Molvin, is switched off in its own player.
- **Vidme:** Every stream sits under `https://vidzen.fun/api/stream/` and needs the Referer `https://vidzen.fun/`. Proxima is not in the server list: it returned nothing for the movie and HEVC DASH for the episode.
- **Vidru:** The API token and the host tokens are bound to the server's IP address. A Cloudflare Turnstile check gates only the player page, not the API. The WebAssembly module gets no imports, so it can only compute.

## Not integrated

- **Vidcore AdFree** (`vidcore.net`): its stream request returned HTTP 500 for every title, also in a real browser. A bytecode VM builds the request, so a server-side port is not practical.

Try Vidcore again only if its own player starts to play these titles.
