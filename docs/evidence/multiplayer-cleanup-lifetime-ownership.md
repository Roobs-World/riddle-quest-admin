# Multiplayer cleanup lifetime ownership

Close, disposal and accepted-response persistence must remain bound to their
originating account until cleanup finishes. A synchronous observer or optional
storage callback may replace the account while that cleanup is running. Old
cleanup must not close the replacement surface, reset its provider search,
replace its delivery or write into its accepted run.

## Reproduction and correction

Five public-session cases failed before correction. Replacement during disposal
or recovery cleanup allowed an old close effect. Disposal reset a genuine new
provider search to idle while its provider request remained pending. Recovery
cleanup and persisted-run reads each allowed an old accepted-response frame to
write an extra time into the replacement account's already-confirmed run.
The ordinary-close positive case passed before and after correction.

Disposal now detaches the original cancellation before external callbacks and
checks its generation after cancellation and gameplay-disposal notification.
It stops before resetting replacement state. Close checks lifetime after recovery
and confirmed-result hint cleanup, then emits only when its own disposal ended
without a replacement account. A normal close still emits once.

Accepted-response persistence pins its original account and authority run before
calling storage adapters. It checks lifetime after recovery cleanup and the
persisted-run read, preserving newer-tab terminal-hint safeguards. The new account's
valid nested start/readiness receipts are persisted by their own handlers only.

## Verification

All 415 client race tests passed before the final gate. The injected browser
verifier uses a public RaceSession subscription probe for replacement during
close: the old close is suppressed and the replacement category delivery stays
recoverable. Separately, it renders the real RaceTo10Game at 1280x900 and 390x844,
closes normally through the real lobby button, replaces the account in that valid
close callback, and starts a fresh game with one close effect and no browser errors.
This does not claim private-state observer injection into the React component.
Screenshots are retained under artifacts/race-cleanup.

The task manifest requires full backend emulator/core/client verification,
types, lint, all seven isolated builds and dependency evidence, Firebase routing,
security/scalability/size/documentation checks and the injected browser verifier.
Completion is recorded only after all checks pass with a stable source digest;
the local progress dashboard is rebuilt from that recorded completion.

No UI text or locale files changed. This verification does not upload, activate
or deploy. Jest activation is permitted, while game publication/review/listing
changes remain held. Firebase Functions deployment is authorized separately.
The ongoing multiplayer edge-case/reliability audit remains active.
