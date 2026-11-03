# Architecture implementation plan

This checklist tracks the approved architecture review and its additional delivery requirements. Completion requires implementation and recorded verification; packaging does not establish submission, approval, or publication.

- [x] R1 — Isolate every Web Target's runtime dependencies, including transitive and lazy imports. Reject another target's modules/SDKs from emitted chunks, copied files, source maps, and final archives. Produce dependency and license evidence outside the artifact. Verify all six required targets and negative contamination cases, including Jest in Facebook.
- [x] R2 — Support integrated Web Targets and neutral distribution platforms through one release registry. Preserve Facebook's SDK and review gates. Provide itch.io a self-contained, root-index HTML5 archive with local saves and its existing manual project/Butler gates. Exercise addition of another destination without duplicating gameplay.
- [x] R3 — Automatically record verified development task completion in the existing platform release dashboard. Include stable task/target IDs, revision, checks, completion time, artifact digests, remaining gates and next action. Make replay idempotent, reject stale revisions and failed/missing checks, persist CI results, and refresh the existing published destination with retryable failures. Preserve provider evidence, dashboard identity and protected runtime.
- [x] 01 — Concentrate Confirmed Progress presentation ordering, including delayed confirmation, dismissal, duplicate receipts, other outcomes, and late rewards. Keep Jest registration in its target adapter.
- [x] 02 — Concentrate Provisional Play recovery: durable queue, leases, checkpoints, paid actions, successor correlation and rollback. Test transitions through storage/time/authority seams.
- [x] 03 — Concentrate Race projection, receipt correlation, rollback, retained input and clock/results reconciliation. Preserve authoritative scoring and ADR-0004.
- [x] 04 — Centralize Web Target release knowledge across commands, packaging, CI and dashboard mappings while preserving provider-specific gates.
- [x] 05 — Prepare and verify one neutral HTML5 source per release run, then reuse it for destination handoffs. Single-target releases prepare fresh sources; failure produces no false readiness.

## Verification and handoff

- [x] Focused transition, release, dependency-isolation and dashboard automation tests.
- [x] Required repository checks and type checks for affected modules.
- [x] Six isolated release builds: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo.
- [x] Applicable injected browser flows, plus neutral itch.io play/save/reload.
- [x] Verified completion evidence appears in the existing dashboard; provider submission states remain evidence-backed.

## Evidence

- Seven production builds passed: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo and GameSnacks. `artifacts/target-dependencies/*.json` binds every emitted chunk and final file to SHA-256; the verifier checks module ownership, runtime packages, copied scripts and source maps. Facebook's artifact audit explicitly rejects Jest leakage.
- Architecture contracts: 28 passed, including real Vite rejection tests for foreign lazy modules, undeclared SDKs, copied scripts and maps across seven targets. Release-script suite: 127 passed. Portal coverage: 130 suites, 836 passed, 75 skipped; thresholds passed. Workspace types, security, TSDoc and maintainable-file checks passed.
- Packaged browser verification: 48/48 passed, including itch.io play/reward/save/reload and Microsoft PWA offline reload. All 46 browser-tested ZIPs match recorded hashes in `artifacts/release-e2e/packaged-games.json`; the wider release integrity check validates 55 dashboard destinations, 52 executable paths and 47 immutable ZIPs.
- Injected Facebook, Reddit, YouTube and Netflix/Yahoo browser checks passed. Jest authenticated scenarios passed 42/42, including delayed completion, Race transitions and retained input. The complete mock Jest journey passed 16/16 across five suites, including queued recovery, onboarding, reward collection and responsive layouts.
- The existing dashboard retains identity `7677b77a-0b56-4194-a2e7-937aff8f27f7`, its private access policy and provider evidence. Authored development progress UI is deployed on `riddle-quest-monitoring-00007-ncx`; refresh uses the existing one-minute snapshot polling.
- GitHub federation and repository variables are configured for the main production-readiness workflow, with access limited to the existing `snapshot.json`. Automatic CI delivery begins when the workflow reaches main. Local accepted-branch handoffs record both the base revision and the tested working-source digest.
- Reproducible completion definition: `docs/development-tasks/architecture-platform-delivery.json`. It runs required checks, hashes artifacts and retains a durable receipt; publication rejects stale revisions and supports idempotent retries. Development verification preserves provider submission/review/publication states.


- Live publication verified at 2026-09-29T21:33:18.573Z: eight development rows for Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, GameSnacks and itch.io. Exact provider evidence and submission queries were preserved. Replaying the same receipt retained eight rows with no duplicates.
- Published receipt: `artifacts/development-progress/architecture_isolated-platform-delivery-2f1eb897f8ef31d29cebd4a7868bd9d0333700c5.json`. Base revision: `2f1eb897f8ef31d29cebd4a7868bd9d0333700c5`; tested working-source SHA-256: `e124bf74d09166b1af808f94fea503f854186f7a7aad40765db24ca22ce24e54`. This records an accepted `jest` branch handoff; it does not claim these uncommitted changes are already on main.
- Check summary: `artifacts/architecture-verification.json`. Automatic future CI delivery starts after the workflow is merged into main; the live dashboard UI and snapshot delivery are already verified.

## Build evidence follow-up

- [x] Keep custom output inventories independent from canonical release evidence, including concurrent builds for the same target.
- [x] Publish dependency evidence only after artifact writing and final auditing complete; late generation, write and cleanup failures leave no successful inventory.
- [x] Verify the real bundler regressions, all seven isolated builds and the Facebook temporary-output harness; record verified completion in the existing dashboard.

Canonical inventories remain `artifacts/target-dependencies/<target>.json`. Custom outputs use `artifacts/target-dependencies/custom/<output-path-sha256>/<target>.json`, outside their shipped directories. Generated-only builds produce no artifact inventory.

- Follow-up verification: 31 architecture checks passed, including independent concurrent outputs, late build failures, generate-only builds and hashing after private source-map cleanup. All seven target builds and 48 packaged browser flows passed. Facebook's temporary-output SDK harness passed and preserved the canonical Facebook inventory byte-for-byte. The harness also waits for settled gameplay audio preferences after asynchronous SDK restoration.

- Follow-up completion is published for eight targets, preserving all prior development, provider and submission rows. Receipt: `artifacts/development-progress/architecture_build-evidence-isolation-2f1eb897f8ef31d29cebd4a7868bd9d0333700c5.json`. Check summary: `artifacts/build-evidence-verification.json`.

Note, 3 November 2026: the platform release dashboard and the private deployment monitor were removed from this repository. Development completion receipts are still written to `artifacts/development-progress/` (the portfolio operations sync reads them); the dashboard items above are historical.
