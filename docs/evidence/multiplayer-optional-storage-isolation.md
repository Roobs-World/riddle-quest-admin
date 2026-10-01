# Multiplayer optional storage isolation

Account-bound run hints and selection journals help reload recovery but do not
confer server authority. Failure of these optional synchronous adapters must not
block authenticated transport, undo an accepted run, suppress provider discovery
or prevent cleanup/close.

## Reproduction and correction

Nine public-session cases failed before correction. A throwing recovery read
blocked cold entry despite a valid confirmed run hint. A throwing run-hint read
hid an independently valid original start receipt. Saving a new selection blocked
start delivery; storage read/save/recovery-clear failures during accepted
preparation produced invalid-response behaviour and blocked readiness. Cleanup
failures prevented ordinary close or accepted abandonment. A failed search journal
write prevented provider discovery and could escape the asynchronous search.

A small storage-boundary module wraps recovery and resume adapters once when the
session is constructed. Reads which throw return no optional hint; write/remove
failures do not interrupt the caller. Calls retain their original method receiver,
arguments and synchronous ordering. Existing lifetime guards still run after each
callback, including when an adapter replaces the account and then throws. There
is no change to server mutation identities, scoring, grants or canonical storage.

Default browser adapters already isolate denied Web Storage. This change extends
that guarantee to the injectable optional-storage boundary; it does not claim the
browser denial behaviour was newly broken.

## Verification

All 426 client race tests passed before the final gate. Eleven new public-session
cases cover the nine reproduced failures, successful receiver-bound resume
persistence, and account invalidation followed by a thrown adapter error. Original
start IDs survive alternate-store failure and accepted preparation chains readiness
without issuing a second start.

The browser verifier runs at 1280x900 and 390x844. A public RaceSession probe uses
throwing adapters for every read/write/remove call; accepted preparation becomes
playable and abandonment still closes once. Separately, the real RaceTo10Game
renders with getItem/setItem/removeItem denied: ordinary close delivers once and
the replacement account starts without browser errors. The latter protects the
existing default adapters. Screenshots are in artifacts/race-storage.

The fresh completion manifest requires full backend emulator/core/client checks,
types, lint, all seven isolated target builds/dependency evidence, Firebase routing,
security/scalability/size/documentation gates and injected browser verification.
The normal completion ledger requires every gate and a stable source digest
before updating the local progress dashboard.

No UI copy or locale files changed. This verification does not upload, activate
or deploy. Jest activation is permitted while game publication/review/listing
changes remain held. Firebase Functions deployment is authorized separately.
The wider multiplayer edge-case/reliability audit remains active.
