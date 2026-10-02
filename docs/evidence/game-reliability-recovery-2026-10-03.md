# Gameplay recovery and native input — 3 October 2026

This is one completed improvement pass within the ongoing multiplayer and single-player reliability, performance, playability and latency goal. The work began on 2 October; logs remain under `artifacts/game-reliability-2026-10-02/`. No client publication or backend deployment was performed by this pass.

## Changes

- Completion retry cleanup now clears both the timer and its retained identifier. React StrictMode effect replay previously cleared the live timer but left the identifier set, permanently suppressing later retry delivery.
- Completion registers its retry before posting to the local bridge, so an immediate acknowledgement cancels that retry. Reconnection immediately retries retained receipts using the original idempotency key instead of waiting for backoff, which can reach 30 seconds.
- Single-player riddle recovery wakes on reconnection and foreground return. It avoids initiating requests while the browser reports offline, retains load deduplication, and checks readiness before resending initialization.
- Host cleanup invalidates pending loads, including final unmount. Content returned by a retired host cannot publish a question or operation acknowledgement. Successful slow loads deliver the latest confirmed profile rather than the profile captured when the request began.
- Both multiplayer and self-contained single-player native answer inputs consume software-keyboard `beforeinput` deletion events into answer slots. These editors normally empty their native value after committing text; relying exclusively on Backspace `keydown` omitted keyboards that send deletion input events. The shared listener ignores disabled editors and active IME composition. Physical Backspace still deletes exactly one slot, forwarded DOM refs remain functional, and Korean composition commits remain deduplicated.

The shared native input helper imports only React. YouTube, Netflix and Yahoo gain no remote service or provider dependency. No visible copy was added or removed. Economy decisions and completion grants remain server authoritative.

## Verification

The new `test:single-player:recovery:browser` command imports the actual React hooks and native input components into an injected browser harness. At 1280 px and 390 px it verifies StrictMode effect replay, stable completion receipts, synchronous acknowledgement, immediate reconnect recovery, fresh-profile delivery, retired-load rejection, software and physical backspace, IME composition, disabled input and forwarded refs. Timing samples are local event-to-callback observations and exclude production network latency; machine-readable results are in `single-player-recovery.json`.

The pre-change completion source fails this browser harness at the effect-replay retry assertion (`browser-baseline.log`). The pre-change input components fail its software-backspace assertion (`native-input-baseline.log`). The focused unit suite passes 17 tests across four suites. The complete client unit run passes 2,246 tests across 265 suites; 117 tests in optional browser suites are skipped by the unit configuration. Core passes 297 tests across 32 suites.

The existing injected live multiplayer harness passes at desktop and phone widths, including lobby identities, countdown, opponent progress, commands superseding held polls, bot fallback and exactly one 50-coin grant. Four selected injected Jest authentication/browser journeys pass: unavailable Daily recovery, confirmed first milestone, guest startup and guest Daily completion. Those tests also validate the extracted authentication harness helper. Synthetic input events establish event handling; this pass does not claim testing on physical mobile devices.

All six required isolated target builds pass their provider-boundary audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Their build commands also check all 16 locales. Portal type checking passes. Build and test logs are stored alongside the timing evidence.

## Broader audit findings

The full hosted-game browser journey still stops at an older recorded-race assertion: opening the current live-only multiplayer intro does not remove a legacy `riddleQuest:activeRaceRun` value. Later recorded-race assertions in that journey are therefore unverified by this run. The dedicated live multiplayer harness and selected solo/authentication journeys ran independently. Updating this older journey to the current live architecture remains follow-up work for the active goal.

The complete client suite initially exposed stale callable expectations for the newly added live-history endpoint. Its declaration and multiplayer region assertions now include that endpoint. The authentication browser test's 1,202-equivalent-line size failure was resolved by moving its typed SDK-state reader into the existing support module; the enforced size limit was preserved. Private history retention fields and the history-capability test received missing declaration comments.

The checkout is shared and other chats modified and committed source during this pass. These checks substantiate this pass's behavior; they do not establish that every concurrent change or provider release is ready. The ongoing goal remains active.
