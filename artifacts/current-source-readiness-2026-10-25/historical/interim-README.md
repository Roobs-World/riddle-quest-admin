# Current Riddle Quest source maintenance, 25 October 2026

This pass addresses source gates that became invalid after the latest gameplay and screenshot work. It leaves the active Jest version and the owner's manual testing session unchanged. No new game upload, activation, review submission or publication was performed.

Two concrete source failures were corrected:

- The TSDoc audit reported 28 undocumented declarations in the screenshot renderer, retirement logic and their existing tests. Descriptive comments now satisfy that gate. TypeScript output with comments removed is identical before and after in all four files.
- The recovery coordinator measured 527 equivalent lines against its existing 500-line limit. Its retained extra-attempt Submit lifecycle now lives in `useQueuedContinueSubmit.ts`. The coordinator measures 496 equivalent lines and the new hook measures 43. The limit was not changed. Exact account, scope, issued question, draft, paid-request ownership, accepted finite-balance receipt, terminal cancellation and one-shot delivery rules remain in the extracted code. The ordinary durable guess callback is unchanged.

The final source digest for this static pass is `7f32b30bb8e2162e14b1f025b90bbd37cbfd27366d222a4ef5b674f961a7463c`. Fourteen compiler and static checks passed with an unchanged source digest during their run. [Checks and hashed logs](static-checks.json), [comment-only emitted-code comparison](tsdoc-runtime-equivalence.json), [six extracted-decision token comparisons](queued-extraction-static-proof.json). The token comparison normalizes moved names and equivalent object-property shorthand. It is source inspection, not a React lifecycle test.

The earlier 24 October records remain intact. All 182 check-log hashes and all 192 receipt hashes still match their recorded values. The current source differs from that baseline, so these records remain historical rather than being relabelled as current verification. [Historical evidence and source census](historical-evidence-census.json).

The dependency inventories show that Jest, Facebook and Reddit include changed shared gameplay modules. The separate YouTube, Netflix, Yahoo and GameSnacks playable entries each have 57 modules and no changed runtime-source module in their recorded inventory. Their candidate artifacts remain byte-identical to their old records, but no fresh build or new provider acceptance is claimed by this maintenance pass.

## Work still requiring validation

Repository instructions require explicit user authorization before tests or browser test harnesses run. No runtime suite or browser harness ran in this pass. The extracted lifecycle still needs the existing recovery unit suites and the five compiled Continue/Classic/shop scenarios on a fresh isolated artifact. Changed public race and server behavior also needs current scoped evidence before refreshing global development receipts. Keep the owner's active manual-test build unchanged while preparing any later candidate.

Current official Jest subscription documentation still describes signed `subscription(s)`, `aud` and `sub`, with additional standard claims such as `iat` optional. It does not establish a mandatory freshness claim, stable paid-period identity or a server-side current-entitlement lookup. The documented replay/freshness limitation remains open; the product was not disabled and no guarantee was invented.

The prior active Jest build remains `1.0.0-dev.20261025-review-complete`, version `01a17226-db08-708f-86a1-6733b1fe4824`. Its earlier 20/20 Simulator evidence applies to those delivered bytes. The new source maintenance changes have not been uploaded or used to replace that build.
