# Deployment policy

Only `https://binje.duckdns.org` may serve a public build.
Previews must require authentication before they reach the app, or be removed.
An unlisted hostname is still public.

## Required operator action

1. Delete the `v1.binje.duckdns.org` and `v2.binje.duckdns.org` DuckDNS records, or put both deployments behind authentication.
2. Remove the old app instances and proxy routes if they are no longer needed.
3. Check that the old builds cannot be reached through another hostname or the server IP.
4. Replace Dokploy's current automatic builds from `main` with a release workflow that builds from a tagged commit.

DNS removal and deployment changes require operator access.
This repository change does not perform those actions.

## Release checks

Every deployment must be built from a tagged commit.
Record the tag, commit SHA, and image digest in the release record.
Use the same tag when rebuilding a preview or production image.
Never use a floating branch head as the release source.

1. Check out the release tag in a clean checkout.
2. Run `git describe --exact-match --tags HEAD` to confirm the source tag.
3. Run `bun install --frozen-lockfile`.
4. Run `bun run lint`.
5. Run `bun run test`.
6. Run `bun run test:dependencies`.
7. Run `bun run build`.
8. Build and deploy the Docker image from that checkout.
9. Run `node scripts/verify-deployment.mjs https://binje.duckdns.org`.
10. Check playback, Google Cast for more than five minutes, subtitles, the mobile API, and both locales.

The verifier checks COOP, `nosniff`, source route availability, and invalid source rejection.
It also checks HLS isolation, wildcard CORS, and `X-Powered-By`.
It sends no credentials and makes no valid stream resolve request.
A failed check returns a nonzero exit code with the failed path and condition.
Pass `http://127.0.0.1:<port>` to check a local production server.

Keep resolver secrets in the persistent Dokploy environment.
The separate host resolver needs its own update procedure in [vidcore-resolver.md](vidcore-resolver.md).
Do not add HSTS `preload` until the old previews are removed and all subdomains meet its requirements.
