# Confirmed grants survive provider confirmation failure

A completed server grant was discarded from the client response when Jest's `completePurchase` returned a failure or threw. The game then showed the original wallet and no purchase fanfare even though coins were already granted.

The exact old journal artifact reproduces both failures. Its paired successful-confirmation control shows 550 coins after the 250-coin grant; returned and thrown confirmation failures both remain at 300, with one checkout, one confirmation attempt, the purchase still pending and no page errors. `results.json` records 1 passing control / 2 failures. Screenshots and literal observations are preserved alongside it.

The minimal repair isolates provider confirmation from the already accepted grant in `packages/portal/src/jest/purchases.ts`. A failed confirmation is reported through the safe browser error reporter. The existing grant result reaches the host/UI, while the provider retains the incomplete token for ordinary startup reconciliation. There is no new queue, retry, checkout or grant attempt, and no visible copy or interface change. Grant failure still blocks confirmation and success presentation.

The exact combined immutable artifact `artifacts/demo-fixes-2026-10-23/jest-artifact` passes all three paired browser cases. Each displays 550 coins. Failure cases retain pending confirmation; each case records exactly one checkout and one confirmation attempt. Final observations, screenshots and JSON are in `../purchase-completion-green/`. All 419 files / 4,718,419 bytes match the manifest before and after the proof. The old red artifact also remains unchanged.

Focused coordinator and purchase-hook unit suites pass 54 tests. Three new lifecycle variants cover returned, thrown and cancelled confirmation, the confirmed 550 wallet, preserved pending token, meaningful observability and a fresh coordinator reconciling that same token with one authoritative award and no second checkout. Production TypeScript, the new lifecycle cases' direct TypeScript and TSDoc pass.

Direct checking both entire legacy purchase test files exposes 27 existing fixture diagnostics. The reconstructed pre-request production file matches root's recorded source hash, and the reconstructed pre-request unit file independently matches two old Jest transform-cache source copies. Before/after compiler diagnostics are identical, with zero new errors. The raw diagnostic log and `test-type-baseline-comparison.json` preserve this limitation. No unrelated fixture edits were made.

`purchases-request.patch` isolates this request from older dirty changes. `purchases-request-integrity.json` proves the reconstructed preedit file matches `artifacts/demo-fixes-2026-10-23/runtime-before.json`.

Root separately observed the official old Simulator wallet remain at 7,325 after one mock pack-2 checkout with a completion error, then become 7,875 after changing the completion response to success and reloading the same player. That is a root-observed server-persistence check, distinct from these synthetic provider browser cases. No real purchase, sensitive token inspection or provider write was performed by this proof.
