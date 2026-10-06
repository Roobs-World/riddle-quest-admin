# Frozen race recording compatibility — 5 October 2026

A separate server guard now checks original frozen question identities, clues and answers against the published question contract before a new recording can authorize play. It runs after modern/legacy archive resolution, inside locked eligibility checks, and before new public/private publication effects. It rejects padded answers, unsupported encoded answer sizes and other incompatible prompt fields without normalizing or rewriting the original recording.

The runtime probe reproduced a hash-consistent, correctly ordered archive that resolved unchanged but could not accept a normal guess for its padded answer. The corrected matching baseline failed four unit cases and eighteen actual SDK cases. With the guard, all twenty new SDK cases and ninety focused cases pass.

SDK coverage includes modern snapshots and original creator-run recovery, current and future malformed answers, prepared and active entry, and both evaluation negotiations. Rejected starts consume no attempt or request, create no run/deck, and record no exposure. Locked eligibility returns the existing content-unavailable classification. Invalid publication grants no achievements, creates no discovery candidate and does not finalize an invitation. Valid decomposed French answers remain unchanged; accepted publication receipts replay unchanged without duplicate grants, including after later fixture corruption. Rejected request namespaces remain available after an explicit test-only repair.

Archive integrity validation and storage parsing retain their previous purpose and original bytes. Cached publication handling precedes the new guard, preserving already accepted receipts. The new guard is a backend leaf module and adds no provider SDK, frontend copy or locale key.

Validation of frozen source:

- 1,669 backend unit tests across 134 suites.
- 401 emulator tests across 27 suites.
- Eight browser tests across three suites against the owned Jest and Reddit builds. The existing buffered-transition assertion remains below 100 ms.
- Backend TypeScript, targeted lint and TSDoc passed.
- All six isolated target builds and audits passed. YouTube remains an incomplete-content fixture build, not release certification.
- All 2,364 selected source inputs stayed unchanged. All 1,300 built files and six target inventories were preserved with SHA-256 hashes before removing only the owned temporary build root and matching metadata. Owned emulator ports closed after normal shutdown.

The first private-publication fixture used an invitation ID that did not contain the creator's owner hash, so two checks reached an existing permission guard. The fixture was corrected; the corrected baseline and fixed runs use the same valid owner binding. Initial logs are preserved separately and are not used as the final red/green evidence. Four missing declaration comments were also corrected before passing documentation checks. A pre-existing legacy recovery fixture used an eight-letter placeholder; it now uses six letters so the positive recovery control fits the already shipped seven-slot contract.

Evidence: [validated summary](../../artifacts/race-recording-compatibility-2026-10-05/verification-summary.json), [runtime reproduction](../../artifacts/race-recording-compatibility-2026-10-05/runtime-probe.log), [matching red units](../../artifacts/race-recording-compatibility-2026-10-05/red-unit.log), [matching red SDK tests](../../artifacts/race-recording-compatibility-2026-10-05/red-emulator.log), [matching green SDK tests](../../artifacts/race-recording-compatibility-2026-10-05/green-emulator.log), [owned changes](../../artifacts/race-recording-compatibility-2026-10-05/owned.diff), and [terminal jobs](../../artifacts/race-recording-compatibility-2026-10-05/owned-jobs.json).

This pass protects new recorded entry, eligibility and new publication. Recovery of retained live tickets and already accepted runs needs separate evidence and implementation. No production latency improvement is claimed. The broader improvement goal remains active.
