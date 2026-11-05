# Dependency security patches

Use `bun install --frozen-lockfile` to install dependencies and apply the patches.
Run `bun run test:dependencies` to check the patches and package compatibility.
CI runs this check in the web job with Node 24.

## Packages without fixed releases

The Bun patches fix the reported paths in the installed packages.
The tests check the installed code. Do not suppress the OSV records or change
package version labels to hide them.

| Package | Advisory | Local fix | Removal condition |
| --- | --- | --- | --- |
| `braces@3.0.3` | [CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm](https://osv.dev/vulnerability/GHSA-vfj7-8cjw-p6xm) | Limit parser nesting and recursive tree walks to 128 levels. Reject deeper input with `SyntaxError`. | A fixed release passes the deep-pattern and tree tests. |

These packages are indirect dependencies of development and mobile build tools.
The braces patch remains because no fixed npm release was available on 2026-11-03.
Node-forge now uses 1.4.2. Its old patch was removed. The signature tests pass against the fixed release.

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
The `@expo/plist@0.8.2` patch passes the XML MIME type that this parser requires.
It also removes whitespace before an XML declaration. Expo's generated entitlement
template starts with a newline, which the stricter parser rejects. Content inside
plist values stays unchanged. Invalid embedded XML declarations still fail.
Remove this patch when Expo's plist caller supplies the MIME type and accepts
the generated entitlement template without it. Tests check both cases.

## Full dependency scan, 2026-11-03

The OSV scan checked all public npm packages in `bun.lock`, including development
and mobile dependencies. It found 34 records before these changes. The final scan
checked 1,329 unique package versions and found five records.

Fixed releases now resolve through these minimum overrides:

| Package | Minimum version |
| --- | --- |
| `undici` | 7.30.1 |
| `@hono/node-server` | 2.1.3 |
| `body-parser` | 2.4.0 |
| `decode-uri-component` | 0.5.1 |
| `fast-uri` | 3.1.9 |
| `node-forge` | 1.4.2 |
| `qs` | 6.16.1 |

The MCP and React Hooks tools permit either Zod 3 or Zod 4. Their old Zod 4 copies
now use the existing patched Zod 3 package. No new direct dependency was added.
The Hono adapter uses a new major version. A local HTTP test checks the server
adapter contract used by the MCP SDK.

### Remaining OSV records

Version scans cannot detect local patches. Keep these records visible.

| Installed version | Advisory | Treatment | Removal condition |
| --- | --- | --- | --- |
| `deepmerge@4.3.1` | [CVE-2026-93753](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4) | Define own data properties when copying or merging keys. This prevents `__proto__` from changing the result prototype. Cover source, CommonJS, and UMD files. | A fixed release passes the prototype tests. |
| `glob@13.0.6` | [CVE-2026-118773](https://osv.dev/vulnerability/GHSA-3g3m-2fjr-6pw4) | Backport the four abort returns from [upstream](https://github.com/isaacs/node-glob/commit/4682e8c9babee1b385202ede36389634e12076d7). Replace the bundled entry points with exports from the patched modules. This also avoids the old Minimatch copies inside the bundles. | Callers accept Glob 14.0.2 or a fixed 13.x release. |
| `glob@11.1.0` | [CVE-2026-118773](https://osv.dev/vulnerability/GHSA-3g3m-2fjr-6pw4) | Not patched. Only `@react-native-tvos/config-tv` uses it, at build time. It calls `globSync` without an `AbortSignal`, and only when `removeFlipperOnAndroid` is set. b!nje does not set this option. The advisory needs asynchronous cancellation. | `config-tv` accepts Glob 14.0.2 or later, or b!nje sets `removeFlipperOnAndroid`. |
| `minimatch@10.2.5` | [CVE-2026-118764](https://osv.dev/vulnerability/GHSA-g3hv-75wg-m249) | Backport [upstream preprocessing bounds](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8) in CommonJS and ESM. | Callers accept Minimatch 11.0.1 or a fixed 10.x release. |
| `minimatch@3.1.5` | [CVE-2026-118764](https://osv.dev/vulnerability/GHSA-g3hv-75wg-m249) | The reported `firstPhasePreProcess` path does not exist in version 3. A test checks that the attack pattern stays one pattern. Keep its callable export for legacy callers. | The advisory range is corrected, or legacy callers adopt a fixed major version. |
| `zod@3.25.76` | [CVE-2023-54404](https://osv.dev/vulnerability/GHSA-mrhx-c7xc-m3w5) | Keep the collection-limit patch described above. | Expo CLI permits a fixed major version. |

The tests check prototype safety, preprocessing limits, cancellation after the first
directory read, normal glob matches, and both module formats. Run
`bun run test:dependencies` after a frozen install. Do not remove a patch based only
on a clean version scan. Test the installed replacement first.
