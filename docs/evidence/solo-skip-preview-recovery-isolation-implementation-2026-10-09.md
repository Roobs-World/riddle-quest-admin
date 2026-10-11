# Skip preview recovery isolation checkpoint

The host lifecycle now handles skip-preview requests through a separate optional delivery controller and deadline. The read requires a currently delivered Classic predecessor and exactly its next index. It does not change the canonical recovery pointer, retire canonical delivery, consume prepared canonical content, join the shared recovery wait, or publish startup/recovery state. Account/provider retirement cancels its bounded wait. A newer canonical delivery or changed predecessor prevents optional publication.

The original two recovery-target diagnostics now pass. Four permanent additions cover failed preview versus accepted-paid successor routing, a failed optional read while canonical content is held, and a late preview after canonical advancement. The old invalid Daily preview expectation now verifies no provider request occurs without a valid Classic predecessor.

Focused host lifecycle/recovery checks pass 40 tests in two suites. Full portal suite passes 3,214 tests in 314 suites, with 96 gated tests in 16 suites skipped. Type checking and TSDoc pass. All jobs completed. Logs and original lifecycle are in `artifacts/solo-skip-preview-recovery-isolation-fix-2026-10-09/`.

This is an implementation checkpoint. Rendered successful-preview flows, deadline and account/provider retirement ordering, whole hosted Skip behavior, and all six isolated target builds plus Devvit remain before handoff. No browser or build claim is made for this version. The change does not claim to cancel provider work already admitted beyond the bounded delivery wait. Nothing was deployed or published; the broader goal remains active.
