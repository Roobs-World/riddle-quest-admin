# Facebook client test candidate — 27 November 2026

The owner explicitly authorized Facebook uploads for testing and then required all Firebase changes to be reverted. Firebase Functions, its configuration and every affected provider server module were restored to `2834dc910a39aa9add734440ddfb8dfd533d30dc`. A path-scoped `git diff --exit-code` and untracked-file check confirmed no remaining backend changes. No Firebase deployment, remote database migration or backend endpoint deletion occurred.

The Facebook game client uses FBInstant adapters and contains no Jest gaming-platform SDK or integration. The preserved Firebase backend still contains its existing provider integrations, as required by the later owner instruction. Jest unit-test tooling is unrelated to the gaming provider and remains available.

## Changes and checks

- Returned Facebook ads must expose the configured placement ID before loading and again before showing. Missing, malformed, mismatched and throwing getters fail closed; account/entitlement guards are checked after the SDK reads. All **33 focused ad tests passed**, including 18 new cases.
- The upload CLI now accepts the explicitly authorized `facebook` branch as well as `main`. It preserves exact archive/source binding, clean-tree requirements and unresolved-handoff barriers. All **9 release-state checks passed**, including allowed/rejected branches and a changed-source rejection without opening a handoff.
- The integrated local Facebook browser journey passed: **one suite, one journey, 28.097 seconds**. Its SDK fixtures now supply the actual requested placement IDs. Existing Messenger, overlays, saves, ads, social and lifecycle checks still pass.
- The canonical production `pnpm build:facebook` passed: **420 files, 4.50 MB total, 0.70 MB initial resources**. Its artifact audit found no Jest/native/credential leakage. Optional banner, Messenger bot and private-tournament deployment flags remain off pending their prerequisites.
- Non-Firebase cleanup removed the notification manager's Jest registration route, authored plan and active schema declaration, plus Sentry's Jest hosting/MCP probes and repair paths. Applied SQL migration history remains unchanged. **31 worker tests**, manager typecheck/build and `git diff --check` passed. Those services were not deployed.

Local logs: `/tmp/riddle-quest-facebook-upload-branch-tests.log`, `/tmp/riddle-quest-facebook-browser-final-integrated.log`, `/tmp/riddle-quest-facebook-testing-candidate-build.log`, `/tmp/facebook-no-jest-worker-tests.log`, and `/tmp/facebook-no-jest-manager-build.log`. The previous combined 398-test run remains recorded in the [expanded candidate verification](facebook-expanded-api-final-verification-2026-11-27.md); this follow-up reran the changed ad behavior and integrated journey.

The read-only hosting check before upload still showed Production version 9 and Testing version 6, with SDK v8 Network Enabled Zero Permissions. Exact upload hash, processing and Testing assignment must be recorded after the authorized transmission. A successful upload is not full API acceptance. The [submission checklist](../facebook-api-submission-checklist-2026-11-27.md) retains provider prerequisites and native journeys; Production promotion, publication and review submission are not authorized by this test-upload instruction.
