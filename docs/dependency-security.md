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

## Compatibility patch

`query-string@7.1.3` loads `decode-uri-component@0.5.0`, which fixes
[CVE-2026-45822](https://osv.dev/vulnerability/GHSA-vcc3-ghjq-m6fr).
The decoder now uses ESM. The patch selects its default export in the CommonJS
caller. The tests check normal queries and malformed percent escapes.
Remove this patch when the caller supports the fixed decoder without a patch.

The `image-size@1.2.1` patch is obsolete. The override now installs `image-size`
2.0.4. The tests check the CommonJS default export used by Metro.

The XML parser override installs `@xmldom/xmldom` 0.9.12 for both plist callers.
The `@expo/plist@0.8.1` patch passes the XML MIME type that this parser requires.
Remove this patch when Expo's plist caller supplies the MIME type itself.
The tests check an Expo plist round trip. Native exports check asset processing.
