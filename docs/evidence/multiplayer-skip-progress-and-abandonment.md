# Skip progress and cross-tab abandonment

Two public-session reproductions failed before the fix. A genuine skip response with its cleared-riddle count removed from both run and event was accepted despite advancing the question. Separately, a real skip committed in the fake authority, another tab abandoned it, and delivery of the canonical abandoned run left the session in racing with no question instead of returning to the lobby.

Paid skip confirmation now requires the confirmed run and its new skip event to advance the original cleared-riddle count. This follows the actual server applyRaceSkip contract, which increments that count before appending the event. Existing terminal completed/timed_out acceptance remains covered.

Accepted gameplay mutations whose canonical run is abandoned now clear attempt/challenge state and return to categories. Pending close intent is honored, empty catalogs are reloaded, and a synchronous account replacement during lobby publication stops old follow-up work. Ordinary abandonment responses retain their existing close path. The hint terminal validator may reject an abandoned hint confirmation and recover through resume; this change does not claim every stale hint payload is directly accepted.

The complete client race suite passes 462 tests across 33 suites. Regressions verify missing skip count, cross-tab skip abandonment, restarting from its lobby and account replacement during that transition. The real UI harness passes ten desktop/mobile cases: hint missing-charge, skip missing-charge, skip unchanged-question, skip unchanged-score and skip abandoned. Semantic failures use one resume and never resend the paid request; abandoned views return to categories without outcome/resume requests. The mobile abandoned lobby was inspected.

The synthetic successful skip browser snapshot now includes the server's cleared-riddle increment in both run and event; previous snapshots were adequate for the earlier charge/position checks but did not prove cleared-count semantics. This pass supplies that evidence. No visible text or translations change.

The completion task runs full backend coverage, core/client checks, seven isolated builds, dependency/security gates and the expanded browser harness before recording current-source completion. Jest activation is authorized; publication/review remain held. Firebase Functions deployment is authorized, but this verification performs no deployment. The broader reliability audit remains active.
