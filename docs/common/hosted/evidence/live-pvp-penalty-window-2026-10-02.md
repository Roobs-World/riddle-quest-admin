# Live PvP penalty finish window — 2 October 2026

A player completing ten riddles with hints or skips no longer ends the match immediately. The server records their fixed adjusted finish (`wall finish + hint penalties + skip penalties`) and lets the rival continue until they finish or their own adjusted elapsed time reaches that finish. The rival's penalties count against their remaining allowance. The lower completed adjusted time wins; equal completed adjusted times draw.

The allowance survives reloads, repeated commands, and closing a completed seat. It also extends beyond the normal five-minute unfinished-match timeout when necessary to honor the completed player's full penalty allowance. Unpenalized finishes retain immediate settlement. Rewards, multiplayer wins, and Facebook referral work remain under the existing transaction and one-time settlement receipt. Bot finishes use their scheduled completion time, independently of polling delays.

The finished player's clock stays fixed and the existing translated waiting message appears inside gameplay. The rival keeps their current question and draft input. No new translation keys or provider dependencies were introduced. Existing working-tree changes making skips count toward completion were preserved.

Validation:

- 21 scoring, transport-failure, and latency unit tests passed.
- 61 Firestore emulator transaction tests passed across live matches, invitations, and Facebook referrals. Coverage includes rapid skips, hints, late rival wins, deadline expiry, reload, completed-seat close, and one-time reward grants.
- 15 race component tests passed.
- The injected browser harness passed at 1280px and 390px against the real emulator authority. Desktop verifies deadline expiry; mobile verifies a later rival victory. Both verify waiting presentation, frozen completion time, draft preservation, and one reward grant.
- All six isolated portal builds and their artifact boundary audits passed: Jest, Facebook, Reddit, YouTube, Netflix, and Yahoo.
- Functions build/type checking, lint, module-cycle audit, file-size audit, and diff whitespace checks passed.
- The repository-wide TSDoc audit remains blocked by undocumented declarations elsewhere in the existing working tree. The new scoring module and new penalty-window tests have no reported undocumented declarations.

Logs and screenshots: `artifacts/live-pvp-penalty-window/`.

This change was validated locally; no deployment was performed.
