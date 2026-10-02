# Multiplayer provider completion delivery deadlines

The preceding provider recovery change handles rejected writes. An adapter promise that never settles still retained its per-run delivery guard forever. Opening or refreshing either corresponding standings view performed new reads but never retried that confirmed run. A lost response after a server commit and a never-delivered request were indistinguishable.

A thirty-second write budget now releases only the exact pending receipt, retaining the failed canonical run for an explicit visit or refresh of its original view. Pending and successful writes remain coalesced. This does not introduce background retries. Late fulfillment or rejection from an expired attempt cannot change the replacement guard or invalidate its current standings read. Successful writes still trigger the fresh read needed to replace a pre-write snapshot.

Write deadlines are cancelled on success, synchronous or asynchronous failure, disposal, account replacement, and confirmed context replacement. Context changes retain old duplicate guards while cancelling their timers and discarding retries, preventing a run from being redirected into a new room. Provider writes remain optional presentation and do not repeat canonical race mutations.

## Retry authority

The existing server implementation records each authenticated player's best server-derived completed run in a Firestore transaction. `facebookTournament.ts` and `facebookContextBoard.ts` retain the existing entry unless the candidate's adjusted time is strictly better. Resending the same run after an uncertain delivery therefore cannot create an additional score or improve the best twice. The client retries through the same target adapter and locale; no new backend behavior, economy grant, SDK import or visible text is added.

## Evidence and handoff

- A standalone probe transpiles the current production module without rewriting its behavior and exercises both adapter destinations with a never-settling write. Both fail the required retry before implementation and pass afterward (`artifacts/race-provider-record-timeout/before.log`, `before.json`, `after.log`, `after.json`).
- Nine new public-interface unit cases failed before the fix; 27 existing cases passed. All 36 provider-view cases pass afterward. Coverage includes the exact 29,999/30,000ms boundary, late success and failure against a replacement attempt, and all timer-cleanup transitions (`unit-before.log`, `unit-after.log`).
- The injected React browser harness uses the production module and a deterministic provider timer seam. Real tournament/Activity tabs exercise no retry before the deadline, one explicit retry afterward, ignored old success/failure, stale-read rejection, fresh standings, repeat navigation without another write, and zero remaining provider timers. Eight desktop/mobile scenarios produce screenshots and logs in the artifact directory.
- The task manifest retains every prior multiplayer gate and adds the delivery-deadline browser harness. Client race regressions, types, documentation, size checks and seven isolated target builds are verified separately while the authorized hosted Jest E2E chat continues editing its evidence document. The full-source completion receipt and dashboard update must wait for stable source; separate checks are not a substitute for that guard.

Jest remains unpublished. The active hosted preview used by the other chat is unchanged by these source edits. No Firebase Functions deployment is required for this client-only fix. The broader edge-case audit remains active.

## Responsive provider navigation found during screenshot review

The mobile deadline harness exposed a Tournaments label extending beyond its button. A dedicated injected component harness reproduced it at 320px: the label scroll width was 124px inside an 85px button. The hub now distributes row space using each label's natural size and permits wrapping where needed. Buttons retain a minimum 44px height; Home/End navigation, optional tournament capability and the single keyboard tab stop remain unchanged. No translated text is removed or added.

The navigation harness checks 108 layouts across all sixteen supported locales, 320/390/1280px widths, normal and enlarged text, and both two-tab and three-tab configurations for English and Arabic. It verifies labels remain within button bounds, minimum target height, selected focus after Home/End, and exactly one tab stop. Evidence and representative English/Arabic screenshots live in `artifacts/race-hub-navigation`. The completion manifest includes this browser gate alongside the deadline and retained recovery gates. Builds are regenerated after the CSS change.
