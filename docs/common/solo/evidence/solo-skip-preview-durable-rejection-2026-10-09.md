# Durable Skip rejection follow-up

The implementation checkpoint's cold ownership test exposed a real persistence failure: rejecting an owned preview restored the paid origin but retained the speculative successor and its draft. The draft could survive into a later mount. The failing result is retained in `artifacts/solo-skip-preview-ownership-fix-2026-10-09/durable-initial.log`.

Paid settlement now filters only the exact speculative session owned by a definitively rejected Skip from retained successors and queued guesses. Other future sessions preserve their identities and order. The original checkpoint remains available for selective rollback; the settled journal removes paid and preview ownership together.

Permanent coverage now includes eleven Skip preview ownership cases, including cold restoration from a durable speculative successor with a draft, malformed optional ownership that must not discard the paid request, and a write failure after the paid request is already durable. The cold test mounts without the original preview ref, proving the durable ownership supplies the rollback bound. Failed writes refuse preview admission; malformed ownership preserves an independently loaded round on rejection.

Focused checks pass 84 tests in three suites. The full client suite passes 3,207 tests in 314 suites, with 96 gated tests in 16 suites skipped. Type checking and TSDoc pass. All processes completed. Logs are in `artifacts/solo-skip-preview-ownership-fix-2026-10-09/`.

This remains an implementation verification checkpoint. Rendered browser flows, account revocation and authoritative-successor supersession scenarios, additional unrelated-successor controls, and all six isolated target builds plus Devvit remain before handoff. No browser or build claim is made for this version. Nothing was deployed or published; the broader goal remains active.
