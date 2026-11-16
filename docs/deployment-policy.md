# Deployment policy

Only `https://binje.duckdns.org` may serve a public build.
Previews must require authentication before they reach the app, or be removed.
An unlisted hostname is still public.

## Current state, checked 2026-11-16

- Dokploy builds and deploys production automatically from each commit to `main`.
- DuckDNS resolves every subdomain of `binje.duckdns.org` to the same server. There are no separate `v1` or `v2` records to delete.
- `v1.binje.duckdns.org`, `v2.binje.duckdns.org`, and a random subdomain all fail the TLS handshake. The old previews no longer serve a build.
- CI runs on each push to `main`, but it does not gate the Dokploy deployment. A commit that fails CI still deploys.

If you add a preview, put it behind authentication before it gets a certificate.

## Release checks

Run these checks on the commit before you merge or push it to `main`:

1. Run `bun install --frozen-lockfile`.
2. Run `bun run lint`.
3. Run `bun run test`.
4. Run `bun run test:dependencies`.
5. Run `bun run build`.

After Dokploy deploys the commit:

1. Run `node scripts/verify-deployment.mjs https://binje.duckdns.org`.
2. Check playback, Google Cast for more than five minutes, subtitles, the mobile API, and both locales.

The verifier checks COOP, `nosniff`, source route availability, and invalid source rejection.
It also checks HLS isolation, wildcard CORS, and `X-Powered-By`.
It sends no credentials and makes no valid stream resolve request.
A failed check returns a nonzero exit code with the failed path and condition.
Pass `http://127.0.0.1:<port>` to check a local production server.

Keep resolver secrets in the persistent Dokploy environment.
The separate host resolver needs its own update procedure in [vidcore-resolver.md](vidcore-resolver.md).
Do not add HSTS `preload` until every subdomain that resolves can serve HTTPS or is removed.
