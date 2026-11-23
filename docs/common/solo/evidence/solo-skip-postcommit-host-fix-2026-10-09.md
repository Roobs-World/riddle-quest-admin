# Committed Skip payment and content-delivery boundaries

The host's Skip handler previously enclosed payment, telemetry and successor loading in one catch. An unexpected loader rejection therefore posted a failed Skip result after the same paid request had already succeeded. The original three-case audit reproduced two failures; the ordinary loader-returning-false control passed.

The handler now catches authoritative payment failure before publishing success. Subsequent loader exceptions are reported as loadRiddle failures with the existing notice channel. Optional telemetry failure cannot prevent the successor load. Ordinary content unavailability retains the real loader's existing recovery path. A committed Skip never becomes a failed payment because of these later operations.

## Verification

- All 35 host-handler tests pass, including three permanent post-commit cases. Loader false, transport rejection and definitive rejection each invoke payment once and retain exactly one successful Skip receipt. Exceptions produce a separately owned loadRiddle failure.
- Rendered actual host-handler/game-router/recovery/reducer/board verification passes 24 journeys and 192 assertions across Chromium 153 and Firefox 153, development and production, widths 390/1280. Checks cover correct receipt ownership, retained settled balance, no automatic payment resend, and an editable successor after later correlated delivery.
- The identical Chromium development harness against the original handler fails eight assertions across six journeys: contradictory paid replies and misattributed content failures. This distinguishes the fix from its baseline.
- Full portal suite: 3,210 tests in 314 suites pass; 96 gated tests in 16 suites skipped. Type checking, TSDoc and file-size checks pass.
- All six isolated target builds and the Devvit server build pass. Archived 1,299 outputs and six dependency inventories; owned temporary outputs removed.
- All 2,553 selected source/config inputs match before, terminal and verified manifests. The host handler and its existing test file changed relative to the preceding verified cohort.

Artifacts, executable verifiers, original handler, logs, screenshots, hashes and archived builds are in `artifacts/solo-skip-postcommit-host-fix-2026-10-09/`. All processes completed. No backend or locale code changed and nothing was deployed or published.

The browser harness injects a successful payment service and loader failure, then supplies a later correlated successor. It proves bridge settlement and successor admission; it does not measure production exception frequency, exercise a live purchase, or prove the automatic host retry scheduler in this cohort. Normal load failures already remain inside the real loader's bounded recovery path. No deployed latency claim is made. The broader improvement goal remains active.
