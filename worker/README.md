# Legacy binje stream resolver (Cloudflare Worker)

This standalone Worker mirrors the resolver for diagnostics. Production clients
use the same-origin Next.js API because the current provider rejects the
Worker's egress. Segment proxying remains on the Next.js `/api/hls` route.

## Deploy

```sh
cd worker
bunx wrangler login
bunx wrangler deploy
```

If binje's domain changes, update `ALLOWED_ORIGINS` in `resolve-worker.js`.
