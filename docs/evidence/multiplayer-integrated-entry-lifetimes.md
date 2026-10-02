# Integrated entry and recovery verification

The complete retained multiplayer browser inventory was rerun after private entry ownership, creator acceptance, callback retirement, waiting invitation selection, cancellation receipts and direct/provider start selection changes. All 57 gates pass, including gameplay checkpoints, rematch/provider replacement, dialogs, resource cleanup, recovery, visibility and actual development StrictMode replay. These are gate counts rather than individual browser case counts.

The current complete client suite passes 1,743 tests across 205 suites, with 102 tests and 13 suites skipped. Core passes 225 tests across 26 suites. The Node22 backend preparation/build/operator safeguards, types/module-cycle audit and lint pass. Invitation/calibration/receipt contracts pass 146 tests across three suites.

Fresh race coverage passes all 1,068 tests across 72 suites against the isolated demo Firestore emulator. Coverage is 93.45% statements, 89.84% branches, 96.98% functions and 95.81% lines. The emulator script exits successfully and shuts down its services; the selected ports have no remaining listeners. No production Firebase calls or deployment are performed.

All 196 captured multiplayer client/verifier files and 334 captured backend source/config files remain unchanged between their before/after observations. This is scoped stability evidence, not an entire-worktree fingerprint. The backend scope includes all `firebase-functions/src/**/*.ts` plus package, TypeScript, race coverage and emulator configuration files, so this run replaces the earlier backend evidence affected by concurrent solo gameplay changes.

All seven isolated builds, exact target dependency inventories, portal types, security and scalability pass. Four dashboard completion protocol tests also pass. Global TSDoc still reports 86 concurrent undocumented declarations, and hosted authentication E2E remains 1,295 equivalent lines against its 1,200 limit. Those failures and ongoing shared-source work prevent a full-source completion receipt.

The manifest retains all 75 checks. Logs, coverage, result records, scoped source comparisons and artifact hashes are held in `artifacts/race-integrated-entry-lifetimes/verification-held.json`. No dashboard completion was recorded, no hosted Jest draft was updated or published, and no Firebase Functions were deployed. The other hosted E2E chat remains uninterrupted. The broader multiplayer reliability audit remains active.
