# Existing attempt opponent consistency

An existing-attempt resume could carry the accepted run/challenge/category but supply another opponent name or recorded target time. Four baseline cases reproduced that acceptance, including two cases that rewrote the public preview to match the contradictory response. Correct opponent and omitted optional opponent views already passed.

Provided opponent details now have to match the private accepted entry's recording name and adjusted target time before the run is adopted. Optional omitted opponent views remain compatible; the client does not synthesize competitive facts to fill them.

The full client suite passes 1,709 tests across 199 suites, with 102 tests and 13 suites skipped. Twelve injected-browser cases cover mismatched names/times, public-preview rewrites, valid opponent details and omitted optional views at desktop/mobile widths. Invalid cases issue neither readiness nor another start and show the existing translated invalid-response error. Thirty-two retained cases pass across pointer identity, private entry selection and startup recovery.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. The backend captured-file recheck is recorded separately. Global documentation and hosted E2E file-size failures remain outside the focused change. Logs, source hashes and artifact hashes are held in `artifacts/race-existing-opponent-authority/verification-held.json`.

The manifest preserves preceding gates and adds opponent consistency, for 69 checks. No hosted Jest update, game publication or Firebase deployment occurred in this batch. Dashboard recording and the broader multiplayer reliability audit remain pending.
