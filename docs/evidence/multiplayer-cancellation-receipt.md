# Cancellation receipt and terminal invitation state

The backend cancellation endpoint commits and returns only `cancelled`. Five baseline failures showed the client accepting waiting/ready/expired responses as successful cancellation, and later waiting/ready entry reads reviving accepted cancellation. A canonical cancelled receipt passed; the original unavailable fixture was malformed and also correctly rejected.

The client now requires cancellation success to carry cancelled state. Once cancelled is accepted, later entry reads retain that terminal invitation lifetime, including waiting, ready, expired and unavailable responses. They cannot trigger an existing-run resume. Expired entries retain their existing protection against waiting/ready revival. No visible copy changed.

The full client suite passes 1,734 tests across 203 suites, with 102 tests and 13 suites skipped. Eighteen injected-browser cases click the actual creator cancellation button, check four incorrect response states and four later read states, and preserve canonical cancellation without further polling. Forty-eight retained cases pass across waiting invitation selection, private entry facts and existing attempt/opponent authority.

The retained waiting harness initially failed because its fixed 1000ms clock advance still used random polling jitter. It now injects random=0.5 alongside the deterministic clock. The valid unavailable fixtures include the schema-required `reason`; failed incomplete-fixture logs are retained separately. The final complete client and browser runs pass.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and file sizes pass; global concurrent documentation and hosted E2E size failures remain. The manifest retains preceding gates and adds cancellation receipts, for 73 checks. Focused source, artifact and log hashes are held in `artifacts/race-cancellation-receipt/verification-held.json`.

Captured race backend files are unchanged from earlier verification; four concurrent solo gameplay files have changed, so no fresh full-backend coverage is claimed. No hosted draft update, Jest publication or Firebase deployment occurred. The other E2E chat remains uninterrupted. Dashboard completion and the broader multiplayer reliability audit remain pending.
