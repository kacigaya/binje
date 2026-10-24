import { pathToFileURL } from "node:url";

export async function verifyDeployment(baseUrl, fetcher = fetch) {
  let origin;
  try {
    origin = new URL(baseUrl);
    if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) throw new Error();
  } catch {
    throw new Error("Deployment target must be an HTTP(S) origin without credentials, a path, or a query.");
  }

  const checks = [
    { path: "/", statuses: [200, 301, 302, 307, 308] },
    { path: "/api/sources", statuses: [400, 401] },
    { path: "/api/resolve?type=movie&id=550&title=Fight%20Club&year=1999&source=bogus", statuses: [400] },
    { path: "/api/hls", statuses: [400] },
  ];
  const failures = [];
  const passed = [];
  for (const check of checks) {
    let response;
    try {
      response = await fetcher(new URL(check.path, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "binje-deployment-check" },
      });
    } catch {
      failures.push(`${check.path}: request failed.`);
      continue;
    }
    if (!check.statuses.includes(response.status)) {
      failures.push(`${check.path}: HTTP ${response.status}; expected ${check.statuses.join(" or ")}.`);
    }
    for (const [header, expected] of [
      ["cross-origin-opener-policy", "same-origin"],
      ["x-content-type-options", "nosniff"],
    ]) {
      if (response.headers.get(header)?.trim().toLowerCase() !== expected) {
        failures.push(`${check.path}: missing or invalid ${header}; expected ${expected}.`);
      }
    }
    if (response.headers.has("x-powered-by")) failures.push(`${check.path}: x-powered-by must be absent.`);
    if (response.headers.get("access-control-allow-origin") === "*") failures.push(`${check.path}: wildcard CORS must be absent.`);
    if (check.path === "/api/hls") {
      const directives = (response.headers.get("content-security-policy") ?? "").split(";").map((value) => value.trim());
      if (!directives.includes("default-src 'none'") || !directives.includes("sandbox")) {
        failures.push("/api/hls: missing isolated CSP; expected default-src 'none'; sandbox.");
      }
    }
    await response.body?.cancel();
    passed.push(`PASS ${check.path}: HTTP ${response.status}`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  return passed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 3) throw new Error("Usage: node scripts/verify-deployment.mjs [origin]");
    const results = await verifyDeployment(process.argv[2] ?? "https://binje.duckdns.org");
    console.log(results.join("\n"));
  } catch (error) {
    console.error(`Deployment verification failed:\n${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 1;
  }
}
