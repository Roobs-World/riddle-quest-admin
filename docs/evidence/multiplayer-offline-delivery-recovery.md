# Multiplayer offline delivery recovery

The actual browser network-offline check passes at 1280px and 390px. A guess, hint or skip sent while offline enters recovery immediately after the rejected fetch, retains `APPLE`, and recovers through a canonical resume read when the player reconnects and clicks Retry. The harness verifies exactly one mutation command and two resume commands per scenario, with no automatic mutation replay or remaining browser errors.

The injected host bridge uses actual HTTP fetch requests with Playwright browser offline mode. This validates client transport recovery; it does not represent a live provider or Firebase outage. The fixture starts with a server-authoritative active run and does not exercise optimistic scoring.

Using the prior `RacePlay` implementation reproduces the defect: the session remains pending instead of entering recovery within 1500ms. The current implementation passes all six action/viewport scenarios. After recovery, question identity, canonical penalty, guess history and selected slot match the original state. The mobile screenshot visibly retains the answer after recovery.

Evidence is recorded in `artifacts/race-offline-delivery-recovery/verification-held.json`, alongside the six-scenario `expanded-browser.log`, the original positive and negative browser logs and screenshots. The new regression harness is `packages/portal/scripts/verify-race-offline-delivery-browser.mjs`; it is included in the 47-check development manifest `docs/development-tasks/race-offline-delivery-recovery.json`.

Documented declarations, file-size limits and exact target dependency evidence pass. No production source changed in this batch. The two production file hashes from the previous analytics verification still match; prior full-client and build results are referenced rather than rerun. That limited hash comparison is not a full-source stability receipt. The exact dependency verifier separately confirms all seven current target artifacts, including the six required platform builds. Current backend coverage evidence remains in `artifacts/race-current-backend-verification/verification-held.json`.

The other chat is still performing hosted Jest user-pathway tests. Its evidence document is left untouched, and guarded full-source verification and automatic dashboard completion recording remain pending until that work finishes. This batch does not upload, activate or publish a Jest build, or deploy Firebase Functions. The multiplayer reliability audit remains active.
