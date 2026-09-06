# Playback provider validation — 2026-09-06

## Implemented

- Added independent VidZee English v4 resolution for movie and TV requests.
- Retained Videasy as the initial default and the existing French resolver.
- Added source selection to the web player and native mobile controls. Selection
  lasts for the mounted player; it is not saved between visits.
- Preserved the native HLS player, subtitles, quality discovery and Cast paths.
  VidZee does not supply fixed-quality `sources`, so native mobile uses its
  adaptive master rather than adding manual quality choices.
- The HLS proxy inherits server-owned Referer headers, follows checked redirects,
  resolves relative links against the final URL, and recognizes HLS masters
  mislabeled as HTML. Invalid HTML becomes a JSON error, not a same-origin page.
- Client resolve results expire after one minute. Retry bypasses the client cache.

These are independent integrations. Dulo's hidden provider inventory remains
unidentified; this branch does not implement “all Dulo sources.” See
[the network investigation](dulo-source-investigation.md) and
[the provider comparison](playback-provider-research.md).

## Verification and limits

- Web/API: 81 tests pass, including provider dispatch, TV coordinates, malformed
  URLs, optional subtitles, redirected manifests, inherited Referer, Cast token
  propagation, rejected private-network redirects and retry cache behavior.
- Mobile: 38 tests pass; TypeScript and Expo lint pass.
- Web: ESLint, TypeScript and production build pass.
- Next dev MCP: no compilation issues, config errors or session errors reported.
- Browser: selected VidZee from the existing-source default, observed its distinct
  resolver request, opened the source menu with a keyboard, and inspected the
  control at 375px width. Error states leave the source control usable.
- Breaking Bad S1E1: live resolver, proxied master, media playlist and MPEG-TS
  segment returned HTTP 200. FFmpeg decoded a frame from the proxied segment.
- Both installed Chromium builds report H.264 and AAC unsupported. Browser video
  frames remain zero, including for existing Videasy streams. End-to-end visual
  playback is therefore **not verified** in this environment.
- Earlier Shawshank research obtained HLS and decoded H.264/AAC transport. Later
  live movie requests for Shawshank and The Godfather returned provider HTTP 502.
  Movie availability is not established by the successful TV transport check.
- No physical mobile device, Safari, or Cast receiver was tested. Subtitle
  filtering is tested; actual rendered subtitle synchronization is not verified.
- No dependencies or paid credentials were added. Source availability depends
  on upstream services. Videasy's announced September 15 shutdown remains a
  separate risk documented in the provider comparison.

## Review

Reviewed changed code and surrounding resolver, cache, player and proxy paths
locally. Fixed stale client retry results and isolated upstream HTML error pages.
An external model review was not used: permission to disclose repository code to
that provider was not established.

The OSV scan queried 1,304 exact public dependency entries from `bun.lock`.
It flagged nine installed package/version entries below. These predate this
branch; no dependency upgrades were made. OSV matches published versions and does
not account for the existing local `image-size` patch. The findings therefore
need a separate applicability review before choosing upgrades.

| Installed package | Advisory / aliases | Supplied severity | Reported affected ranges |
| --- | --- | --- | --- |
| `@humanfs/node@0.16.7` | [GHSA-p498-v437-472g](https://osv.dev/vulnerability/GHSA-p498-v437-472g); No CVE alias supplied | CVSS_V4: CVSS:4.0/AV:L/AC:L/AT:P/PR:N/UI:P/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N | introduced 0 → fixed 0.16.8 |
| `@xmldom/xmldom@0.8.13` | [GHSA-6gmq-8vp8-gcm6](https://osv.dev/vulnerability/GHSA-6gmq-8vp8-gcm6); CVE-2026-83610 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N | introduced 0.7.0 → fixed 0.8.15; introduced 0.9.0 → fixed 0.9.12 |
| `browserslist@4.28.2` | [GHSA-73wf-gq98-2v4g](https://osv.dev/vulnerability/GHSA-73wf-gq98-2v4g); CVE-2026-73088 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H | introduced 0 → fixed 4.28.7 |
| `browserslist@4.28.2` | [GHSA-c83g-rgw3-j3cx](https://osv.dev/vulnerability/GHSA-c83g-rgw3-j3cx); CVE-2026-73089 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H | introduced 0 → fixed 4.28.7 |
| `decode-uri-component@0.2.2` | [GHSA-vcc3-ghjq-m6fr](https://osv.dev/vulnerability/GHSA-vcc3-ghjq-m6fr); CVE-2026-45822 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:U/S:N/AU:Y/R:U/V:D/RE:M/U:Amber | introduced 0 → fixed 0.5.0 |
| `fast-uri@3.1.5` | [GHSA-5jgf-p345-68v8](https://osv.dev/vulnerability/GHSA-5jgf-p345-68v8); CVE-2026-75931 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.4.2 → fixed 2.4.5; introduced 3.1.3 → fixed 3.1.6; introduced 4.0.1 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-f65p-4m7j-42xc](https://osv.dev/vulnerability/GHSA-f65p-4m7j-42xc); CVE-2026-75975 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.3.1 → fixed 2.4.5; introduced 3.0.0 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-fph4-wmhf-6fwf](https://osv.dev/vulnerability/GHSA-fph4-wmhf-6fwf); CVE-2026-75899 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.4.1 → fixed 2.4.5; introduced 3.1.2 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `fast-uri@3.1.5` | [GHSA-jqff-g426-hqxp](https://osv.dev/vulnerability/GHSA-jqff-g426-hqxp); CVE-2026-76172 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | introduced 2.3.1 → fixed 2.4.5; introduced 3.0.0 → fixed 3.1.6; introduced 4.0.0 → fixed 4.1.3 |
| `image-size@1.2.1` | [GHSA-5p2g-fcmc-qvqq](https://osv.dev/vulnerability/GHSA-5p2g-fcmc-qvqq); CVE-2025-71329 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N | No fix supplied |
| `image-size@1.2.1` | [GHSA-w3rx-r6r6-pgpr](https://osv.dev/vulnerability/GHSA-w3rx-r6r6-pgpr); CVE-2025-71330 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:X/CR:X/IR:X/AR:X/MAV:X/MAC:X/MAT:X/MPR:X/MUI:X/MVC:X/MVI:X/MVA:X/MSC:X/MSI:X/MSA:X/S:X/AU:X/R:X/V:X/RE:X/U:X | No fix supplied |
| `postcss-selector-parser@7.1.1` | [GHSA-w9m9-85wc-3x92](https://osv.dev/vulnerability/GHSA-w9m9-85wc-3x92); CVE-2026-9358 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N/E:P | introduced 6.1.0 → fixed 6.1.3; introduced 7.1.0 → fixed 7.1.3 |
| `qs@6.15.3` | [GHSA-4mjr-xmp4-gh2g](https://osv.dev/vulnerability/GHSA-4mjr-xmp4-gh2g); CVE-2026-82417 | CVSS_V3: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N | introduced 2.2.5 → fixed 6.16.0 |
| `qs@6.15.3` | [GHSA-x5fp-wj9c-mxmx](https://osv.dev/vulnerability/GHSA-x5fp-wj9c-mxmx); CVE-2026-82562 | CVSS_V3: CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L; CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N | introduced 6.14.2 → fixed 6.16.0 |
| `@xmldom/xmldom@0.9.10` | [GHSA-6gmq-8vp8-gcm6](https://osv.dev/vulnerability/GHSA-6gmq-8vp8-gcm6); CVE-2026-83610 | CVSS_V4: CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N | introduced 0.7.0 → fixed 0.8.15; introduced 0.9.0 → fixed 0.9.12 |
