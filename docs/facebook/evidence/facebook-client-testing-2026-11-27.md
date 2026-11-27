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

## Version 10 upload and hosted smoke check

The authorized single upload completed processing as **version 10**, bundle **28866544233023588**, and was assigned to **Testing**. Production remains version 9. The ZIP downloaded independently from Meta matched SHA-256 `3634d6dec39aab6b4f40d815c3ac8b2ccf2f6244e78d3377531f44f179ce50eb` exactly: 2,863,662 bytes from clean source `b64f96aa2b3b1db3c3171f03ed4f207a588ee87e`. The local handoff was reconciled as accepted; it must not be retransmitted. [Sanitized acceptance and host evidence](facebook-testing-version-10-2026-11-27.json).

The exact hosted game completed real SDK startup and displayed the authenticated account's Classic game. Privacy Policy and Terms of Use each opened Meta's confirmation with the correct fixed HTTPS destination; cancelling returned control to Settings. The Facebook social panel displayed zero connected friends and an empty tournament list. Activity loaded its empty recent-matches state. This desktop host does not advertise overlay factories, haptics, session-score methods or the complete bot-consent/private-tournament families, so their native paths remain unverified here.

Hosted testing found one client handling defect: `context.createAsync` is advertised, but its no-player picker form returns `CLIENT_UNSUPPORTED_OPERATION` with “Client does not support no player IDS or multiple player IDs yet”. The client initially showed a retryable race error and retained the action. A follow-up must retire that unsupported picker form without disabling other context methods or automatically attempting another mutation. No invitation, message, purchase, notification opt-in or review submission occurred.

A successful upload is not full API acceptance. The [submission checklist](../facebook-api-submission-checklist-2026-11-27.md) retains provider prerequisites and native journeys; Production promotion, publication and review submission are not authorized by this test-upload instruction.

## Unsupported picker correction

The controller now remembers `CLIENT_UNSUPPORTED_OPERATION` only for its no-argument context picker. It hides that action for the current account/controller lifetime, including after refresh and panel reopening. The admitted SDK promise still receives context reconciliation before feedback retires. A cancelled panel cannot receive a late notice. The single-player-ID creation form and existing `context.chooseAsync` workflow remain intact; no fallback mutation starts automatically.

The panel reuses the existing translated unavailable message instead of the generic race-failure alert. The focused regression was red before the fix (two failures, eight passing) and green afterward (**10 tests passed**). The integrated browser journey passed (**one suite, 26.810 seconds**) with the exact native rejection fixture, one rejected call, no picker resurrection and the existing successful context chooser. The [mobile unavailable state](expanded-api-2026-11-27/unsupported-friend-picker-mobile.png) was visually inspected. The canonical production Facebook build passed again with **420 files, 4.50 MB total and 0.70 MB initial resources**. Firebase and every affected provider server path still match `2834dc910` exactly.

## Version 11 accepted in Testing

The corrected candidate completed processing as **version 11**, bundle **29932177596379493**, and is assigned to **Testing**. Version 10 is now Standby; Production remains version 9. The archive was built from clean source `85b8c43d72bca17280592b33eec690c23756c78c`: **2,863,715 bytes**, **422 ZIP entries**, SHA-256 `b520e2763bef9d50d5e9eb9a5e5883475e68a24f47d9ebb3d75550eeb08201c2`. An independent download from Meta matched the hash and byte count. The local upload record is accepted; no retransmission is needed. [Sanitized acceptance evidence](facebook-testing-version-11-2026-11-27.json).

On this exact hosted version, real SDK startup completed. The unsupported **Choose friends** picker disappeared after the native rejection and displayed the translated unavailable status without the generic race error. Refresh did not restore it. **Play with friends** opened Meta's native chooser; closing it restored the controls without selecting a recipient or sending an invitation. Closing the race dialog returned to the game with Multiplayer available.

No Firebase source/configuration/provider-server change or deployment occurred. These observations establish this desktop correction and upload identity; they do not establish mobile support, conditional API eligibility, production approval or completion of every checklist journey. This record is a documentation-only follow-up to the uploaded source and does not require another build or upload.
