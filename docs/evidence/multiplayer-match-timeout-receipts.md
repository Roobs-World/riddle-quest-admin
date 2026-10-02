# Timeout matchmaking receipts and calibration

Canonical race settlement writes `terminalStatus: timed_out` after maximum adjusted-time expiry. The matchmaking offer reader and calibration measurement schema accepted only completed or abandoned states. A genuine timeout therefore became unreadable attribution and could prevent an allowlisted calibration export from completing.

Both schemas now accept the genuine timed_out terminal state. Existing invariants still prohibit treating it as a completed ten-answer finish or attaching uncensored performance, prediction-error or finish-gap evidence. Calibration counts these races in the measured terminal non-completion denominator rather than as ongoing or corrupt observations. Reward calculation, outcome settlement and offer selection are unchanged.

The focused Node 22 receipt and calibration suites contain 45 passing tests. Four new genuine-timeout cases failed before the schema correction; the other 41 cases passed. New negative controls retain rejection of completed-finish evidence on timeout receipts. Calibration tests prove that one full finish plus one timeout yields two measured terminal races, a 50% completion rate and only one complete-finish performance/gap/error observation. The receipt export still removes private account and answer fields.

A real Firestore emulator round trip expires a canonical accepted challenger at maximum adjusted time, reads the actual settlement-written receipt, validates it through the receipt parser and later transactional attribution reader, and verifies repeated outcome reads leave it unchanged. The focused integration command initially selected a config that excludes integration tests; rerunning with `jest.race-coverage.config.js` and focused coverage disabled executed the intended test successfully. Logs are under `artifacts/race-match-timeout-receipts/`.

The discovery cancellation and late-provider-result paths were also inspected against the existing ownership, timeout, navigation and account-replacement regression tests. No change was justified in those paths. Backend types pass; an undocumented new test declaration was documented before full verification.

The task manifest retains the previous 26 verification gates and adds focused timeout receipt/calibration contracts for 27 total. The existing full backend coverage gate includes the new emulator round trip. All client/browser regressions and seven isolated builds remain required. Full validation and dashboard completion recording are pending; source-digest protection remains unchanged.

Jest activation is authorized but publication remains on hold. Firebase Functions deployment is authorized; this verification run does not itself deploy Functions.
