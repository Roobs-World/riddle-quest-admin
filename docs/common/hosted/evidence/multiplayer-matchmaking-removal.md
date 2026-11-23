# Multiplayer fallback rematch capability removal

A completed empty-pool fallback race could revive its preceding matchmaking adapter when the live capability resolver explicitly returned unavailable. The nullish fallback treated capability removal as permission to reuse the cached adapter. Rematches now use the live resolver's result whenever that resolver exists. Legacy direct consumers without a resolver retain their existing cached-adapter behavior.

The unit regression failed before the production change: the retired adapter received a second search. Replacement and legacy controls passed. The full client suite now passes 1,659 tests across 193 suites, with 99 tests and 13 suites skipped.

Four injected-browser cases exercise the actual rendered multiplayer result and rematch buttons: capability removal and replacement, each at desktop and mobile widths. Removed capabilities issue no further search; replacements issue one search through the new adapter with a fresh request receipt. Neither starts an unintended fallback race. Both retained search-journal browser cases also pass.

All seven configured isolated target builds, exact dependency evidence, portal types, security and scalability checks pass. Global documentation and file-size checks still report concurrently edited subscription, solo lifecycle and hosted E2E files; this focused change is absent from those reports. Logs, source hashes and artifact hashes are recorded in `artifacts/race-matchmaking-removal/verification-held.json`.

The development manifest retains prior gates and adds this browser regression, bringing it to 57 checks. Full-source completion and the automatic dashboard receipt remain pending while the user-owned Jest pathway E2E chat finishes. This batch does not claim to address pending searches against replaced adapters. No hosted Jest update, publication or Firebase deployment occurred. The broader multiplayer reliability audit remains active.
