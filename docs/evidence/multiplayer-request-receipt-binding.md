# Multiplayer request receipt binding

30 September 2026 local development evidence. Releases remain restricted to named
HTML5 platforms; standalone web/PWA builds remain excluded. This change does not
deploy backend code, publish a provider release or modify production records.
Translations and visible UI text are unchanged.

## Reproduced failure

Six public-interface emulator regressions failed before the fix. Reusing a guess
request ID with changed letters, question or evaluation projection returned the
original success. Reusing a hint ID for another operation attempted to decode the
wrong cached response. Historical start and reservation receipts could return a run
or lobby in a different language from the new request.

## Accepted command ownership

One typed command intent now reaches the mutation module rather than separate run
and request ID arguments. A versioned operation discriminator and SHA-256 digest
are written atomically with accepted scoring, abandonment, start, publication,
reservation and cancellation receipts. A matching request address must have the
same owner, operation and input. Changed intent fails before new mutations; corrupt
owner or binding metadata fails closed without a legacy downgrade.

Fixed field tuples make the digest independent of object order and request ID.
Omitted booleans use their established false default. Guess whitespace and NFC
normalization match the engine's submitted feedback. Raw guesses are not added to
binding metadata; the digest is an intent check, not encryption of the input.
Start evaluation projection remains outside its binding because start replay
resumes and projects the currently owned run afresh. Prepared readiness remains
idempotent through the canonical owned run and its fixed scheduled start.

Historical receipts without bindings prove the recoverable original intent through
strict operation response schemas and the owned immutable deck/run or reservation.
Scoring replay retains its original prompt and guess feedback even after advancement.
Publication replay checks its committed challenge and reservation scope. Exact
supported historical replays do not reapply penalties, grants or action clocks.
Historical metadata cannot prove every original optional category/preparation
choice; missing facts are not invented. A fallback alias may legitimately resume
a run originally created with another preparation choice. Ambiguous historical
publication scope is rejected rather than silently treating it as new intent.

Already accepted fallback offers now create a receipt for every new start request
alias. Concurrent retries coalesce without content reads or restarting the run;
the source run must agree with the original offer's owner, language, category,
physical ID and synthetic opponent provenance. Already published runs also retain
new request aliases, their first returned preview and reservation intent, without
repeating publication grants. Nested receipt expiry remains capped to its parent.

Accepted and cached mutation responses are validated inside the transaction,
including their hydrated privacy-safe opponent identity. An undeliverable projection
aborts every staged run, account, reward, outbox and receipt write. A matching digest
does not authorize a damaged response. Existing deletion/block authorization and
privacy minimization continue before delivery.

## Verification and remaining work

Public-interface emulator tests cover changed input and operation, forged owners,
corrupt/unsupported binding metadata, exact historical replays, Unicode equivalence,
concurrent fallback aliases, corrupted fallback sources, publication aliases and
reservation scope. Invalid response metadata tests verify complete rollback of a
paid hint and a winning tenth answer, including staged account and durable-outbox
writes; damaged accepted receipts cannot charge again.

Stable-source verification uses
`docs/development-tasks/race-request-receipt-binding.json`: Node 22 backend build,
operator safeguards, full race coverage, types and lint; client recovery; seven
isolated platform builds and dependency audits; security, scalability, TSDoc and
source-size checks. The completion receipt updates the existing local dashboard.
The broader multiplayer reliability goal and separate deployment/provider gates
remain open.
