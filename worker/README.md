# binje stream resolver (Cloudflare Worker)

vidfast.pro sits behind Cloudflare, which **403s Netlify/AWS server IPs**. A
Cloudflare Worker's egress gets through. This Worker does only the resolve step
(page scrape + enc-dec.app chain → m3u8 url). Segment proxying stays on Netlify
`/api/hls` because the stream CDN blocks the Worker's IP but serves Netlify's
server-side fetch.

## Deploy

```sh
cd worker
bunx wrangler login
bunx wrangler deploy
```

Note the deployed URL (e.g. `https://binje-stream.<subdomain>.workers.dev`).

## Wire it to binje

Set in Netlify → Site settings → Environment variables (build-time):

```
NEXT_PUBLIC_RESOLVE_BASE = https://binje-stream.<subdomain>.workers.dev
```

Then redeploy binje (push to `main`). Local dev needs nothing — it defaults to
`/api`, which reaches vidfast.pro fine from a residential IP.

If binje's domain changes, update `ALLOWED_ORIGINS` in `vidfast-worker.js`.
