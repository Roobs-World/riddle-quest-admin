# Optional Skip delivery and canonical recovery isolation

Optional Skip preview reads now own a separate bounded delivery controller. A preview must follow the currently delivered Classic question by exactly one index. It cannot change the canonical recovery index, abort a canonical request, consume prepared content, publish recovery state, or publish after account/provider retirement or canonical advancement. Failed previews leave recovery on the issued predecessor; accepted paid Skip loads retain the successor recovery target.

Preview and successor-preparation helpers load on demand. Deferred preparation rechecks account, provider, generation and predecessor ownership before borrowing a prepared result. Startup initial resources are 576,530 bytes against the unchanged 576,716.8-byte budget, leaving 186.8 bytes. This is an artifact size measurement, not measured player startup latency.

Verification on the production source cohort:

- 88 focused tests in four suites pass; the full portal suite passes 3,214 tests in 314 suites, with 96 gated tests in 16 suites skipped.
- Chrome and Firefox, development and production React, each pass 16 cases and 88 assertions: 64 cases, 352 assertions total. Cases cover successful/failed previews, held canonical delivery, deadlines, account/provider retirement, canonical advancement and failed-load recovery at 390px and 1280px. These exercise the actual host lifecycle in injected React harnesses.
- All 14 built-game hosted coin-action tests pass against the production Jest artifact. They cover Hint, Continue and Skip flows, including immediate Hint and buffered Skip before held receipts are released.
- Portal types, TSDoc (27,828 declarations across 1,224 files), file-size checks, all six isolated target builds, and the Devvit server build pass. YouTube uses the fixture build.

The first hosted run timed out after Skip settlement because its test expected the entire journal to disappear. Focused diagnostics show the correct successor and 175-coin balance, with the paid request and preview marker removed and the successor draft retained. The browser test now waits for receipt settlement independently of retained drafts and bounds page waits at eight seconds. All 14 cases then pass. No production change was needed for that timeout.

Evidence is in `artifacts/solo-skip-preview-recovery-isolation-fix-2026-10-09/`. Source manifests cover 2,555 inputs. Before/terminal production inputs match; the final manifest differs only in the explained hosted browser test (`final-harness-source-delta.json`). All running jobs were drained before that test edit. The 1,307 built outputs and six target inventories are archived with hashes; the owned temporary build root and only its inventory metadata were removed.

These checks use injected providers and local servers; they do not establish production cloud latency or live payment-provider behavior. Nothing was deployed, committed, or pushed. The broader reliability/performance/playability goal remains active.
