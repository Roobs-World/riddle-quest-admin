# Multiplayer restored hint integrity

Restored selection journals are untrusted intent data. The injected storage
boundary must validate account, locale, version, expiry and request fields before
using them. Restored run IDs use authoritative request normalization and bounds,
so the pending command owns the same opaque identifier the server will return.

## Reproduction and correction

Nineteen cases failed before correction across public-session recovery and browser
storage seams. Foreign, stale, future, incompatible and malformed adapter-provided
selection records either issued an unintended start or threw before transport.
Invalid injected run values became pending resume commands. A valid padded run ID
was retained unnormalized, so a canonical authority reply could not match it.
Browser run reads also admitted an overlong ID and returned padded IDs unchanged.

Default browser selection recovery already validates these records. The session
storage wrapper now applies that same parser to injected selection adapters too,
retaining valid alternate hints and exception isolation. Both default and injected
run hints use RaceRunIdRequestSchema normalization and size bounds. Oversized
serialized browser run hints are ignored before JSON parsing.

Malformed legacy run cleanup, active-run cleanup and selection-revision cleanup
could delete a hint installed after their initial read. Each now rechecks the
exact serialized value before removal. This is an optimistic best-effort check,
not an atomic Web Storage compare-and-swap; it protects the reproduced replacement
between the observed read and recheck, without claiming all cross-tab races are
eliminated. Existing unchanged legacy cleanup and owner/run/revision checks remain.

## Verification

All 446 client race tests passed before the full gate. Twenty added cases cover
the nineteen initial failures and the existing whitespace rejection. Positive
legacy cleanup, matching removal, receiver-bound storage, alternate recovery,
valid command receipts and account lifetime cases remain in the full race suite.

The browser verifier renders real RaceTo10Game at 1280x900 and 390x844. A persisted
padded ID resumes the original run into gameplay with no new start. A controlled
Storage.getItem hand-off replaces a malformed observed value with another account's
valid hint; the lobby remains usable and that replacement survives cleanup.
A separate public-session probe supplies unchecked foreign selection/numeric run
hints and verifies safe category discovery. Browser errors and unintended resume/
start commands are checked. Screenshots are under artifacts/race-hints.

The task manifest requires full backend emulator/core/client checks, types, lint,
seven isolated target builds and dependency evidence, Firebase routing,
security/scalability/size/documentation checks and injected browser verification.
The normal completion ledger requires all gates with an unchanged source digest
before updating the local progress dashboard.

No visible copy or locale files changed. This verification does not upload,
activate or deploy. Jest activation remains allowed; game publication/review/listing
changes remain held. Firebase Functions deployment is separately authorized.
The broader multiplayer reliability audit remains active.
