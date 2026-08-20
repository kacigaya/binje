/**
 * Entry point for the b!nje cast companion.
 *
 * Run with `bun run cast:companion`. See `companion/README.md` for the Chrome
 * flags the DevTools connection needs.
 */

import { createCastController } from "./cast-controller";
import { fetchBrowserSocketUrl } from "./chrome";
import { openCdpConnection, webSocketAdapter } from "./cdp";
import { readCompanionConfig, SERVER_HOSTNAME } from "./config";
import { createCastServer } from "./server";

const config = readCompanionConfig(process.env);

const controller = createCastController({
  allowedOrigins: config.allowedOrigins,
  connect: async () => {
    const socketUrl = await fetchBrowserSocketUrl(config.chromeDebugPort);
    return openCdpConnection(webSocketAdapter(socketUrl));
  },
});

const server = createCastServer(config, controller);

const listener = Bun.serve({
  hostname: SERVER_HOSTNAME,
  port: config.port,
  fetch: (request) => server.fetch(request),
});

console.log(`b!nje cast companion listening on http://${SERVER_HOSTNAME}:${listener.port}`);
console.log(`Chrome DevTools port: ${config.chromeDebugPort}`);
console.log(`Allowed origins: ${config.allowedOrigins.join(", ")}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await server.close().catch(() => undefined);
  await listener.stop(true);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
