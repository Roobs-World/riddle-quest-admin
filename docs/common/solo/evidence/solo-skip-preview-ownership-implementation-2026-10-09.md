# Skip preview ownership implementation checkpoint

The current implementation adds optional durable ownership of an admitted Skip preview to the pending journal. Preview admission validates the issued predecessor, exact next Classic index, active origin/preview ownership and paid request. It requires a successful journal write before returning admission. The reader discards malformed optional ownership while preserving a valid paid journal. Authoritative early successor admission retires speculative rollback ownership durably.

Definitive rejection restores the paid action's issued segment only while its origin or exact recorded speculative session is current. Independently loaded next-index and later rounds are preserved. Paid receipt settlement removes the optional ownership alongside the action.

Eight new permanent ownership cases plus existing successor/journal coverage pass: 81 tests in three suites. Type checking and TSDoc pass after correcting an optional-value type narrowing and documenting test fixtures. Logs are in `artifacts/solo-skip-preview-ownership-fix-2026-10-09/`.

This is an implementation checkpoint, not a completed handoff. Required next checks include cold ownership restoration, malformed ownership, failed durable writes, dependent speculative requests/drafts on rejection, account revocation, authoritative-successor supersession, rendered browser flows, full client tests and all six isolated target builds plus Devvit. No build or browser claim is made for this implementation yet. Nothing was deployed or published; the broader goal remains active.
