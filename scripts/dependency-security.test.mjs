import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
const mobileLoad = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const jestLoad = createRequire(mobileLoad.resolve("jest/package.json"));
const jestCoreLoad = createRequire(jestLoad.resolve("@jest/core/package.json"));
const micromatchLoad = createRequire(jestCoreLoad.resolve("micromatch/package.json"));
const braces = micromatchLoad("braces");
const expoLoad = createRequire(mobileLoad.resolve("expo/package.json"));
const expoCliLoad = createRequire(expoLoad.resolve("@expo/cli/package.json"));
const forge = expoCliLoad("node-forge");
const linkingLoad = createRequire(mobileLoad.resolve("expo-linking/package.json"));
const queryString = linkingLoad("query-string");

test("Expo fingerprint and legacy glob callers can expand braces", () => {
  const fingerprintLoad = createRequire(expoLoad.resolve("@expo/fingerprint/package.json"));
  const modern = fingerprintLoad("minimatch").minimatch;
  const legacy = jestCoreLoad("minimatch");
  for (const match of [modern, legacy]) {
    assert.equal(match("app/home.tsx", "app/{home,search}.tsx"), true);
    assert.equal(match("app/player.tsx", "app/{home,search}.tsx"), false);
  }
});

test("Zod rejects oversized collections before parsing children", async () => {
  const root = dirname(expoCliLoad.resolve("zod/package.json"));
  const variants = [
    expoCliLoad("zod"),
    expoCliLoad("zod/v4"),
    await import(pathToFileURL(join(root, "index.js")).href),
    await import(pathToFileURL(join(root, "v4/index.js")).href),
  ];
  for (const { z } of variants) {
    let parsed = 0;
    const element = z.string().refine(() => { parsed += 1; return true; });
    const oversized = new Array(20_000);
    Object.defineProperty(oversized, 0, { get() { throw new Error("element read before size check"); } });
    for (const schema of [z.array(element).max(2), z.array(element).length(2)]) {
      const result = schema.safeParse(oversized);
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].code, "too_big");
      assert.equal((await schema.safeParseAsync(oversized)).success, false);
    }
    assert.equal(z.set(element).max(1).safeParse(new Set(["a", "b"])).success, false);
    assert.equal(z.set(element).size(1).safeParse(new Set(["a", "b"])).success, false);
    assert.equal(parsed, 0);
    const nested = z.object({ titles: z.array(element).max(1) }).safeParse({ titles: ["a", "b"] });
    assert.deepEqual(nested.error.issues[0].path, ["titles"]);
    assert.deepEqual(z.array(element).max(2).parse(["a"]), ["a"]);
    assert.equal(z.array(element).min(2).safeParse(["a"]).success, false);
    assert.equal(parsed, 2);
    if (z.array(z.number()).overwrite) {
      assert.equal(z.set(z.string().transform(() => 'same')).max(1).safeParse(new Set(['a', 'b'])).success, false);
      assert.equal(z.map(z.string().transform(() => 'same'), z.number()).check(z.maxSize(1)).safeParse(new Map([['a', 1], ['b', 2]])).success, false);
      assert.deepEqual(z.array(z.number()).refine(values => { values.splice(2); return true; }).max(2).parse([1, 2, 3]), [1, 2]);
      assert.deepEqual(z.array(z.number()).overwrite(values => values.slice(0, 2)).max(2).parse([1, 2, 3]), [1, 2]);
    }
  }
});

test("braces rejects deep brace and parenthesis patterns before walking them", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"], ["({", "})"]]) {
    for (const suffix of [close.repeat(2000), ""]) {
      const pattern = open.repeat(2000) + "a,b" + suffix;
      for (const method of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => method(pattern), {
          name: "SyntaxError",
          message: "Nesting depth exceeds maximum of 128",
        });
      }
    }
  }
});

test("braces rejects deep caller-supplied syntax trees", () => {
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    let ast = { type: "text", value: "a" };
    for (let depth = 0; depth < 2000; depth++) {
      ast = { type: "root", nodes: [ast] };
    }
    assert.throws(() => method(ast), {
      name: "SyntaxError",
      message: "Nesting depth exceeds maximum of 128",
    });
  }
});

test("braces preserves normal glob compilation and expansion", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/{a,b}.ts"), [
    "src/app/a.ts", "src/app/b.ts", "src/lib/a.ts", "src/lib/b.ts",
  ]);
  assert.equal(braces.compile("src/{app,lib}/*.ts"), "src/(app|lib)/*.ts");
  assert.equal(braces.stringify(braces.parse("src/{app,lib}/*.ts")), "src/{app,lib}/*.ts");
});

test("braces methods use the same nesting boundary", () => {
  for (const method of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.doesNotThrow(() => method("{".repeat(127) + "a,b" + "}".repeat(127)));
    assert.throws(() => method("{".repeat(128) + "a,b" + "}".repeat(128)), {
      name: "SyntaxError",
      message: "Nesting depth exceeds maximum of 128",
    });
  }
});

// Exponent one makes RSA decoding deterministic and isolates DigestInfo validation.
const publicKey = forge.pki.rsa.setPublicKey(
  new forge.jsbn.BigInteger("f".repeat(256), 16),
  new forge.jsbn.BigInteger("1", 10),
);
const digest = forge.md.sha256.create().update("dependency patch regression").digest().getBytes();

function signature({ parameters = true, extra = false } = {}) {
  const { asn1 } = forge;
  const algorithm = [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
    asn1.oidToDer(forge.pki.oids.sha256).getBytes())];
  if (parameters) algorithm.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""));
  if (extra) algorithm.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "garbage"));
  const encoded = asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, algorithm),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
  ])).getBytes();
  return "\x00\x01" + "\xff".repeat(128 - encoded.length - 3) + "\x00" + encoded;
}

test("RSA verification accepts valid DigestAlgorithm sequences", () => {
  for (const parameters of [false, true]) {
    assert.equal(publicKey.verify(digest, signature({ parameters })), true);
  }
});

test("RSA verification rejects extra nested DigestAlgorithm elements", () => {
  for (const parameters of [false, true]) {
    assert.throws(() => publicKey.verify(digest, signature({ parameters, extra: true })),
      /does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo/);
  }
});

test("query-string loads the fixed ESM decoder from CommonJS", () => {
  assert.deepEqual({ ...queryString.parse("name=caf%C3%A9&tag=a&tag=b") }, {
    name: "café", tag: ["a", "b"],
  });
  assert.equal(queryString.parse("bad=%C0%AF").bad, "%C0%AF");
});

test("malformed percent escapes finish without exponential decoding", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const assert = require("node:assert/strict");
    const queryString = require(process.argv[1]);
    const input = "%C0%AF".repeat(10000);
    assert.equal(queryString.parse("bad=" + input).bad, input);
  `, linkingLoad.resolve("query-string")], { timeout: 5000, encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("Metro can use the fixed image-size CommonJS default export", () => {
  const reactNativeLoad = createRequire(mobileLoad.resolve("react-native/package.json"));
  const cliLoad = createRequire(reactNativeLoad.resolve("@react-native/community-cli-plugin/package.json"));
  const metroLoad = createRequire(cliLoad.resolve("metro/package.json"));
  const imageModule = metroLoad("image-size");
  const imageSize = imageModule.__esModule ? imageModule.default : imageModule;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
  assert.deepEqual(imageSize(png), { width: 1, height: 1, type: "png" });
});

test("Expo can parse and write plists with the fixed XML parser", () => {
  const plist = expoCliLoad("@expo/plist").default;
  const value = { CFBundleName: "b!nje", Enabled: true, Count: 3 };
  assert.deepEqual({ ...plist.parse(plist.build(value)) }, value);
});

test("Expo can read entitlement templates with leading whitespace", () => {
  const plist = expoCliLoad("@expo/plist").default;
  const value = { CFBundleName: "  b!nje  ", Enabled: true };
  const xml = plist.build(value);
  for (const prefix of ["\n", "\r\n", "\uFEFF\n \t"]) {
    assert.deepEqual({ ...plist.parse(prefix + xml) }, value);
  }
  assert.throws(() => plist.parse(xml.replace("<dict>", '<dict><?xml version="1.0"?>')));
});

test("overrides match direct dependency ranges for npm-based EAS steps", () => {
  const manifests = [
    mobileLoad("../../package.json"),
    mobileLoad("./package.json"),
  ];
  const { overrides } = manifests[0];
  for (const manifest of manifests) {
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (name in overrides) {
          assert.equal(overrides[name], range, `${manifest.name} ${field}.${name}`);
        }
      }
    }
  }
});

test("deepmerge preserves prototypes when either input has an own __proto__ key", async () => {
  const root = dirname(expoCliLoad.resolve("deepmerge/package.json"));
  const variants = [
    expoCliLoad("deepmerge"),
    createRequire(join(root, "index.js"))(join(root, "dist/umd.js")),
  ];
  const payload = JSON.parse('{"__proto__":{"admin":true},"nested":{"value":1}}');
  for (const merge of variants) {
    for (const result of [merge({}, payload), merge(payload, {}), merge(Object.create(null), payload)]) {
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(result.admin, undefined);
      assert.deepEqual(result.nested, { value: 1 });
    }
    const key = Symbol("setting");
    assert.deepEqual(merge({ [key]: { first: 1 } }, { [key]: { second: 2 } })[key], { first: 1, second: 2 });
  }
});

test("modern minimatch bounds preprocessing in both module formats", async () => {
  const fingerprintLoad = createRequire(expoLoad.resolve("@expo/fingerprint/package.json"));
  const root = dirname(fingerprintLoad.resolve("minimatch/package.json"));
  const variants = [fingerprintLoad("minimatch"), await import(pathToFileURL(join(root, "dist/esm/index.js")).href)];
  for (const { Minimatch } of variants) {
    const pattern = new Minimatch("x", { optimizationLevel: 2, braceExpandMax: 64 });
    const expanded = pattern.firstPhasePreProcess([Array(12).fill("**/../a/b").join("/").split("/")]);
    assert.equal(expanded.length, 64);
    const large = new Minimatch("{x,*}/{0..999}", { optimizationLevel: 2 });
    assert.equal(large.set.length, 2000);
    assert.equal(large.match("y/999"), true);
    const small = new Minimatch("**/../a/b/**/../c/d", { optimizationLevel: 2 });
    assert.equal(small.set.length, 4);
    assert.equal(small.match("../a/b/../c/d"), true);
  }
  // Version 3 has no firstPhasePreProcess or optimizationLevel expansion.
  const legacy = jestCoreLoad("minimatch");
  const pattern = new legacy.Minimatch(Array(30).fill("**/../a/b").join("/"), { optimizationLevel: 2 });
  assert.equal(pattern.globParts.length, 1);
  assert.equal(pattern.firstPhasePreProcess, undefined);
});

test("glob stops directory reads after cancellation in both module formats", async () => {
  const fs = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const root = dirname(expoCliLoad.resolve("glob/package.json"));
  const variants = [expoCliLoad("glob"), await import(pathToFileURL(join(root, "dist/esm/index.min.js")).href)];
  const directory = fs.mkdtempSync(join(tmpdir(), "binje-glob-"));
  try {
    fs.mkdirSync(join(directory, "a/b/c"), { recursive: true });
    fs.writeFileSync(join(directory, "a/b/c/file.txt"), "test");
    for (const { glob } of variants) {
      assert.deepEqual(await glob("**/*.txt", { cwd: directory }), ["a/b/c/file.txt"]);
      const controller = new AbortController();
      const reason = new Error("cancel walk");
      let reads = 0;
      const pending = glob("**/*", {
        cwd: directory,
        signal: controller.signal,
        fs: {
          readdir(path, options, callback) {
            reads += 1;
            fs.readdir(path, options, (error, entries) => {
              controller.abort(reason);
              callback(error, entries);
            });
          },
        },
      });
      await assert.rejects(pending, (error) => error === reason);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(reads, 1);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the Hono adapter retains the MCP server contract", async () => {
  const sdkLoad = createRequire(expoCliLoad.resolve("@modelcontextprotocol/sdk/package.json"));
  const { Hono } = sdkLoad("hono");
  const { createAdaptorServer } = sdkLoad("@hono/node-server");
  const app = new Hono();
  app.get("/health", (context) => context.json({ ok: true }));
  const server = createAdaptorServer({ fetch: app.fetch });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
