# Terminal paid receipt recovery

Confirmed wins and losses previously discarded an unresolved paid journal entry and cancelled its retry, while leaving the local charge pending. A missing response could therefore block progression indefinitely.

The journal now retains the owned payment until settlement, removes redundant guesses for the completed question, and retries the original request before completion acknowledgement. Cold restoration attaches the retained journal without replaying terminal gameplay. Settlement preserves buffered successor requests and drafts. Account ownership, exact request identity, retry leases, and canonical terminal state remain enforced.

The server review confirms that Continue, Hint, and Skip reject a new charge on a terminal session; their existing replay paths recover committed actions. No server code or balance policy changed in this pass.

## Verification

- Original diagnostic: two failures and two controls; all four pass on the final source.
- Focused tests: 104 tests in five suites pass, including five permanent terminal-payment cases.
- Full portal suite: 3,182 tests in 311 suites pass; 96 gated tests in 16 suites skipped.
- Type checking, TSDoc, and file-size checks pass.
- Injected router/hook/reducer/storage browser verification: 128 journeys and 1,952 assertions across Chromium and Firefox, development and production, and two viewport sizes. Coverage includes wins, losses, held responses, exact retries, reload, account changes, success/rejection, and buffered successor ownership.
- Full hosted app verification: eight journeys and 88 assertions across both browsers and build modes. The app remains inert while payment is unresolved; settlement enables the actual victory/Next interactions and a fresh editable round. The fixture uses one immutable seeded receipt to model a cached reply, not a live payment service.
- All six isolated target builds and the Devvit server build pass. Archived 1,299 output files and six dependency inventories.
- All 2,550 selected source/config inputs match before, terminal, and verified manifests. Five portal source/test files changed relative to the preceding verified pass.

Evidence and executable harnesses are in `artifacts/solo-terminal-paid-liveness-fix-2026-10-09/`. The initial full-app harness attempted a click while the app was correctly inert; the corrected harness observes that state and interacts after settlement. An initial automatic permission review timed out before process creation; the identical approved retry completed successfully. All jobs finished and owned temporary build directories were removed.

These checks establish local and injected-host behavior. They do not measure deployed player latency or prove real backend payment transactions. Nothing was deployed or published. The broader improvement goal remains active.
