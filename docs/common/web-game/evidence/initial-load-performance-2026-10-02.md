# Initial load optimization — 2026-10-02

The self-contained targets now ship every locale as a separately emitted JavaScript module. The startup envelope contains only metadata and pack loaders. Only the selected locale is downloaded and evaluated. Save compatibility reads the content version without first loading and validating the English pack. Locale validation, save ordering, and SDK lifecycle gates remain in place.

Failed pack downloads retry with a fresh local module URL because browsers cache rejected module imports. Successful loads share one promise. Development keeps the source document and normal Vite content watching.

## Measurements

Five fresh Chromium contexts per target; mobile viewport 390 × 844; 4× CPU slowdown; uncompressed local assets; no browser cache; deterministic 300 ms external SDK responses. YouTube uses French; other targets use the browser's default English. The final performance run was separate from the browser regression suites.

Initial JavaScript counts the entry and its HTML modulepreloads. The selected pack adds about 45–49 KB before gameplay, so total JavaScript needed for play falls by approximately 66%, while entry JavaScript falls by 70.5–70.6%. Every locale remains in the same artifact; no external content service is introduced.

| Target | Entry JS before (bytes) | Entry JS after (bytes) | Reduction | Median DOMContentLoaded before → after |
| --- | ---: | ---: | ---: | ---: |
| jest | 478,688 | 478,688 | 0.0% | 52.5 → 56.9 ms |
| facebook | 559,636 | 559,636 | 0.0% | 381.1 → 380.0 ms |
| reddit | 559,623 | 559,623 | 0.0% | 105.2 → 103.8 ms |
| youtube | 1,094,937 | 322,698 | 70.5% | 385.3 → 354.6 ms |
| netflix | 1,094,297 | 322,055 | 70.6% | 88.0 → 52.7 ms |
| yahoo | 1,094,293 | 322,051 | 70.6% | 85.4 → 51.6 ms |

First contentful paint was essentially unchanged (YouTube's mandatory SDK remains the principal gate). These measurements establish a smaller startup transfer and less eager parsing, not a real-world time-to-play guarantee. All pages did not reach 50 ms under these conditions. Raw runs are in `artifacts/initial-load-performance/before.json` and `after.json`.

## Validation

- Six production targets built and passed their artifact isolation audits in an isolated checkout containing only this change.
- A final shared-checkout Jest rebuild fails because concurrent edits import missing `src/styles.profile-details.css`; `shared-build-failure.log` records it. The six isolated builds cover this change against the starting revision.
- Portal type checking passed in the isolated checkout and the shared workspace.
- 45 YouTube unit tests and 139 release-script tests passed.
- 10 existing YouTube browser tests also passed against the explicit engineering fixture.
- 14 injected browser tests passed across YouTube, Netflix/Yahoo, and focused Jest music/modal flows.
- Dedicated content browser checks passed for all 16 locales, failed chunk retry without an early save/gameReady, and SDK pause/resume during pack download.
- Screenshots of all six startup surfaces were captured; the French playable menu was visually checked.
- Broader pre-existing Jest/Facebook/Reddit browser suites fail multiplayer expectations: legacy race-run storage cleanup and race-hub tabs. These paths are outside the content-loading change.
- Repository TSDoc audit still reports 28 existing undocumented declarations in Firebase tests and the classic supply worker; changed declarations passed.

## Reproduce

Build all six targets first, then run:

```sh
pnpm --filter @qwordly/portal measure:initial-load /tmp/initial-load.json --expect-split-content
pnpm --filter @qwordly/portal test:playable-content:browser
pnpm --filter @qwordly/portal test:youtube:unit
pnpm --filter @qwordly/portal test:release-scripts
```

The dedicated content browser check expects the complete release YouTube artifact. The separate existing YouTube browser suite also verifies the explicit engineering fixture.
