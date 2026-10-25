# Dependency security patches

Use `bun install --frozen-lockfile` to install dependencies and apply the patches.
Run `bun run test:dependencies` to check the patches and package compatibility.
CI runs this check in the web job with Node 24.

## Packages without fixed releases

OSV still flags these package versions. The Bun patches fix the reported paths.
The tests check the installed code. Do not suppress the OSV records or change
package version labels to hide them.

| Package | Advisory | Local fix | Removal condition |
| --- | --- | --- | --- |
| `braces@3.0.3` | [CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm](https://osv.dev/vulnerability/GHSA-vfj7-8cjw-p6xm) | Limit parser nesting and recursive tree walks to 128 levels. Reject deeper input with `SyntaxError`. | A fixed release passes the deep-pattern and tree tests. |
| `node-forge@1.4.0` | [CVE-2026-85393 / GHSA-86w9-cpqp-85rv](https://osv.dev/vulnerability/GHSA-86w9-cpqp-85rv) | Reject extra elements in the nested RSA `DigestAlgorithm` sequence. Use the element-count check from [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152). | A fixed release passes the valid-signature and nested-element tests. |

These packages are indirect dependencies of development and mobile build tools.
No fixed npm release was available on 2026-10-22.

## Zod collection limits

`zod@3.25.76` matches [CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5](https://osv.dev/vulnerability/GHSA-mrhx-c7xc-m3w5).
Expo CLI requires Zod 3. Forcing Zod 4 would break that dependency contract.
The local patch rejects oversized arrays and sets before parsing their elements.
It also protects leading size bounds on the bundled Zod 4 array, map, and set entry points.
A bound before a custom or overwrite check limits raw input size. A later bound
keeps its original order because an earlier check can change the value.
Oversized raw sets and maps now fail even if element transforms would merge entries.
This deliberate change prevents work on input that exceeds the declared limit.
CommonJS and ESM tests check early rejection, nested error paths, async parsing,
and normal inputs. Zod 4 overwrite checks keep their original order.
The approach follows the [upstream size-check fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd).

The patch covers the compiled npm entry points used by this project.
Do not enable the `@zod/source` condition without applying the same fix to its TypeScript source.
Remove the patch when a compatible Expo CLI dependency passes these tests without it.
OSV continues to report the original package version.

## Compatibility patch

Keep `brace-expansion` on each caller's requested major version. A global override
to version 1 breaks the named `expand` export used by Expo fingerprint's
`minimatch` 10 dependency. The lockfile selects fixed releases for both legacy
and modern callers. A regression test checks brace patterns through both APIs.

`query-string@7.1.3` loads `decode-uri-component@0.5.0`, which fixes
[CVE-2026-45822](https://osv.dev/vulnerability/GHSA-vcc3-ghjq-m6fr).
The decoder now uses ESM. The patch selects its default export in the CommonJS
caller. The tests check normal queries and malformed percent escapes.
Remove this patch when the caller supports the fixed decoder without a patch.

The `image-size@1.2.1` patch is obsolete. The override now installs `image-size`
2.0.4. The tests check the CommonJS default export used by Metro.

The XML parser override installs `@xmldom/xmldom` 0.9.12 for both plist callers.
The `@expo/plist@0.8.1` patch passes the XML MIME type that this parser requires.
It also removes whitespace before an XML declaration. Expo's generated entitlement
template starts with a newline, which the stricter parser rejects. Content inside
plist values stays unchanged. Invalid embedded XML declarations still fail.
Remove this patch when Expo's plist caller supplies the MIME type and accepts
the generated entitlement template without it. Tests check both cases.
