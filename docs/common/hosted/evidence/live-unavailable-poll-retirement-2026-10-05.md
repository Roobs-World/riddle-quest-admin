# Expired invitation polling retirement — 5 October 2026

An authority-confirmed unavailable live invitation now ends its polling scheduler. The scheduler clears its owned timer before recognizing this terminal state. Reconnect and visibility events cannot restart it. Invitation confirmation, joining, retirement and result authority keep their existing behavior.

The timer audit followed the [recovery wakeup fixes](/home/craig-beswetherick/Documents/riddle-quest/docs/evidence/live-recovery-wakeups-2026-10-05.md). Those fixes preserve reconnect, foreground and countdown signals during in-flight reads or commands and retry queued observations when backoff expires.

The minimal fixture reproduced one retained polling timer and 58 unnecessary callbacks during a 1,200 ms observation, in both development and production. The provider recorded one rejected join and one matching unavailable confirmation. A single scheduler stop condition reduced both timer ownership and callbacks to zero. The final expanded baseline failed all three new checks: timer release, idle callbacks and repeated recovery events. Its callback count was 69; this varies with browser scheduling and fixture timing.

The permanent regression extends the existing real React `RaceTo10Game` invitation journey and observes only its native polling timer through the fixture loader. It covers nine scenarios and three viewports, including late confirmation, account/provider replacement, removal, retryable confirmation and ordinary parent updates. Each React mode passed 369 assertions. Recovery and polling retirement reruns added 648 assertions, for 1,386 passing browser assertions on the final source. The earlier recovery source had separately passed 1,830 assertions.

Firefox verified native invitation acceptance, matching server confirmation, 20 reconnect/visibility cycles and native close. Confirmation left zero polling timers, polling callbacks and delivery deadlines. Recovery events produced no new join or confirmation. Close returned to the multiplayer intro without a leave, grant or completion event. No browser errors or unhandled rejections occurred. The provider and scheduler instrumentation are injected test seams; these results do not certify an external provider or total CPU usage.

Final validation passed: 2,855 unit tests in 300 suites; types; 25,523 documented declarations in 1,144 files; all six isolated target audits; and eight built-artifact browser tests in three suites. The buffered transition threshold remained 100 ms. YouTube used the incomplete-content fixture build, not release certification. No product strings, scoring, purchase, reward or SDK contract changed.

The final checks re-enumerated and verified 1,517 stable source inputs. All 1,300 built files and six audit metadata records were preserved before deleting the owned temporary outputs and metadata. Every owned job reached a terminal result. The Firefox server, cache and owned tab were closed; the pre-existing blank tab remains. The goal is active.

- [Machine-checked summary](../../../../artifacts/live-unavailable-poll-retirement-2026-10-05/verification-summary.json)
- [Owned change](../../../../artifacts/live-unavailable-poll-retirement-2026-10-05/own.diff)
- [Firefox records](../../../../artifacts/live-unavailable-poll-retirement-2026-10-05/firefox-native.json)
- [Regression extension](/home/craig-beswetherick/Documents/riddle-quest/packages/portal/scripts/verify-live-confirmation-retirement-browser.mjs)
