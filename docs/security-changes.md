# Security changes

## F1: Public previews

The old `v1` and `v2` previews can expose builds without current controls.
The [deployment policy](deployment-policy.md) permits only the production host to be public.
It requires authentication or removal for previews and a tagged commit for each build.
The operator must remove the two DuckDNS records or protect both deployments.
This patch does not change DNS, Dokploy, or running deployments.

Verify after deployment:

```sh
node scripts/verify-deployment.mjs https://binje.duckdns.org
```

The command fails on missing COOP or `nosniff`, stale API routes, invalid source handling,
unsafe HLS CSP, wildcard CORS, or `X-Powered-By`.

## F2: HLS response isolation

The global page CSP overrode the HLS sandbox.
Range requests and large responses could pass upstream HTML through the app origin.
The page CSP now applies through `proxy.ts` only to page paths.
API responses use `default-src 'none'; sandbox`.
HLS success, error, and preflight responses also set this policy directly.

HLS rejects HTML, XHTML, and SVG before size or Range checks.
Other streamed bodies must have an allowed media type.
Bounded reads still recognize text playlists and image-wrapped TS segments.
Missing MIME types require a recognized playlist, TS, or WebVTT body.
Small octet-stream bodies that start with HTML are rejected.
Sniffing enforces the 32 MiB limit and a body deadline even when Content-Length is false.
SSRF checks, the stream host allowlist, and redirect validation keep their existing rules.

Run `bun run test` for the Range, MIME type, CSP, playlist, segment, and subtitle regressions.
Check the built server because framework header handling also affects this control.

## F3: API CORS and request limits

Data routes previously sent `Access-Control-Allow-Origin: *`.
They now send no anonymous CORS header. No browser consumer is documented.
Native mobile clients continue to call the API without CORS.
Google Cast keeps its token-protected receiver CORS on `/api/hls`.

Search has a separate limit of 30 requests per minute per IP.
All `/api/mobile/*` paths share a separate limit of 60 requests per minute per IP.
Existing HLS and resolve limits stay at 600 and 20.
Blocked requests return 429 and `Retry-After`.
These limits remain in memory per app instance.

Run `bun run test` to check bucket isolation, reset timing, 429 responses, and CORS headers.

## F4: Cast token scope and lifetime

Cast previously accepted an empty POST and issued a token valid for six hours on any allowed host.
It now requires JSON with a stream `url` and optional `subtitles` URL list.
Every target must pass the existing stream allowlist and private-network checks.
An originless native request still works. Cross-origin requests still return 403.

Tokens expire after five minutes and bind to the app host and approved media hosts, including ports.
Validated redirects and playlist children inherit the token scope without extending its lifetime.
Cast responses use `no-store` so cached responses cannot bypass token expiry.
Web and native senders reload Cast media every four minutes to renew authorization.
They keep position, pause state, and selected subtitles. Renewal can cause a brief reload.
Authorization requests have a five-second deadline.
Failed renewals get two retries, 15 seconds apart. Disconnect and cleanup cancel pending retries.
The sender must remain active. A suspended sender can miss renewal and stop playback.
Deploy the updated web sender and distribute the updated native sender with this API change.

Run the web and mobile tests for empty bodies, host mismatch, expiry, origin checks, and renewal.
Use a real Cast receiver for a session longer than five minutes before release.
Hardware Cast and mobile background suspension need manual verification.

## F5: Response hardening and contact

`public/.well-known/security.txt` provides the contact URL, languages, expiry, and canonical URL.
Renew it before 2027-10-01.
HSTS now sets `max-age=31536000; includeSubDomains`.
It does not request preload. Remove the stale previews before considering preload.
`poweredByHeader: false` remains set. API failures keep generic response bodies.

Run `bun run test` and the deployment verifier.
Check `/.well-known/security.txt` on the built server.
