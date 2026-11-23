# Gameplay receipt latency and account ownership — 3 October 2026

This pass removes optional profile transport from accepted gameplay receipts and prevents old account work from crossing an identity replacement. It continues the active game reliability goal; it is not a production deployment or a claim that all improvement opportunities are exhausted.

## Changes

- The Firebase host adapter returns server-confirmed completion and coin-spend receipts immediately. Profile refresh remains server authoritative but runs separately; its failure cannot turn a committed mutation into a failed client operation.
- Profile publication captures the current account visit and refresh ordering. Late responses cannot replace a newer profile, switch the host back to an old account, or publish after subscription retirement. Adapter consumers share one native auth observer.
- Background follow-ups after completion, guessing, hints, and skips retain the admitting account. A delayed deletion cannot sign out a replacement account. Classic/Daily caches retire when identity changes.
- Restored target profile data belongs to the first account using it. A replacement account waits for its own authoritative profile instead of showing the previous account's coins. Account creation generation distinguishes recreated identities sharing a UID.
- Riddle recovery resets its progression pointer and readiness for a replacement account. The game reducer retires the old riddle, guesses, pending economy state, victory modal, and completion outcome. Completion delivery cancels old-account retry timers and ignores their acknowledgements. Same-account profile notifications preserve the player's draft.

## Reproduction and measurements

The receipt harness builds the actual Firebase host adapter with injected SDK identity and authority callables. Each callable returns an accepted receipt immediately, followed by a deliberately delayed 300 ms profile read. Five samples per action were collected at 1280 px and 390 px.

| Action | Baseline median at both widths | Updated median at both widths |
| --- | --- | --- |
| Completion receipt | 300.1 ms | Below browser timer resolution |
| Coin-spend receipt | 300.1 ms | Below browser timer resolution |

These results demonstrate removal of the optional 300 ms read from the critical path. They do **not** measure production backend latency or imply that production requests take zero time. Raw samples: `artifacts/game-authority-2026-10-03/receipt-timing-{before,after}.json`.

The baseline adapter source came from commit `bcd2c48b`; its SHA-256 was `8c342c275467948cd57b71c93a59c7a3e2d2299b9ba21d4e6ff08644a4b9316b`. The first seven adapter ownership/receipt regression cases failed that baseline and passed the updated implementation. Additional tests exercise observer sharing, same-UID re-entry, retired callbacks, and delayed old-account mutations.

The actual React StrictMode browser harness reproduces an Alice victory followed by a Bob auth notification. The baseline game reducer retained `victory`, failing the expected cleared-modal assertion. Updated code clears the old victory and riddle, rejects Alice's receipt acknowledgement, stops retries through reconnect, and accepts Bob's next question. It also verifies restored profile isolation, reconnect recovery, late-load rejection, and native deletion/IME behavior. See `account-browser-baseline.log`, `recovery-browser-final.log`, and `single-player-recovery.json` in the same artifact directory.

## Validation

- Portal unit suite: 266 suites, 2,266 tests passed; 118 opt-in tests skipped in this run. Focused state/receipt/recovery regression run: 46 tests passed.
- Core unit suite: 34 suites, 313 tests passed.
- Injected receipt and actual React recovery browser harnesses passed at 1280 px and 390 px.
- Live multiplayer browser harness passed at both widths: identities, countdown, progress, held-poll supersession, immediate victory, one 50-coin grant, navigation, missing capability, and bot fallback.
- Eight selected real Jest host authentication browser journeys passed: guest launch, login, registration/reload, platform restoration, milestone reporting, Daily completion, and registration with delayed completion confirmation.
- Jest, Facebook, Reddit, YouTube, Netflix, and Yahoo production builds and artifact isolation audits passed after the runtime changes.
- Portal types, TSDoc, and maintainable-file-size checks passed. No new visible product copy was added.

Build and validation logs are saved under `artifacts/game-authority-2026-10-03/`. The checkout is shared with other active chats, so full-suite counts and builds include their contemporaneous changes. This evidence describes the receipt and account ownership improvements specifically.

## Remaining work

The older monolithic hosted-browser journey still expects the retired recorded-race entry. It needs migration to the current live multiplayer UI; the current live harness passed separately. Further useful investigation includes deadline recovery for hanging authority requests and preventing optional content follow-ups from starting after account replacement.
