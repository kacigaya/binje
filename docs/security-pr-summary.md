# Security PR summary

Fix HLS isolation, API CORS, request limits, and Cast authorization.
Add deployment checks and a security contact.

1. **F1, operator action required:** Delete the `v1.binje.duckdns.org` and `v2.binje.duckdns.org` DuckDNS records, or put both deployments behind authentication. Remove unused app instances and proxy routes. Replace automatic builds from `main` with builds from tagged commits. This patch does not perform those operations. See [deployment-policy.md](deployment-policy.md).
2. **F2, files touched:** `app/api/hls/route.ts`, `next.config.ts`, `proxy.ts`, and `lib/security-headers.ts`, with regression tests. Page CSP no longer applies to API routes. HLS rejects active document types before Range or size checks and limits other streamed content types.
3. **F3, behavior change:** Remove wildcard CORS from data and mobile APIs. Search has 30 requests per minute per IP. Mobile routes share a separate 60-request bucket. Existing HLS and resolve limits remain. Responses over the limit keep 429 and `Retry-After`.
4. **F4, lifetime change:** Reduce Cast tokens from six hours to five minutes. Require JSON target URLs and bind tokens to app and media hosts. Renew every four minutes in web and native senders. Renewal preserves position, pause state, and subtitle selection. It can cause a brief reload. A suspended sender can miss renewal. Older native clients need an update for Cast.
5. **F5, files added:** Add `public/.well-known/security.txt`. Add `includeSubDomains` to HSTS without preload. Keep `poweredByHeader: false` and generic API errors. Supporting documents: `docs/deployment-policy.md`, `docs/security-changes.md`, and this summary.

Validation requires `bun install --frozen-lockfile`, `bun run lint`, `bun run test`,
`bun run test:dependencies`, and `bun run build` after each batch.
Also check native types, lint, tests, Expo compatibility, and both platform exports.
Test a real Cast receiver for more than five minutes before release.
