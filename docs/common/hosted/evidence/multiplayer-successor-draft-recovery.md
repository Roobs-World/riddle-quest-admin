# Multiplayer successor draft recovery

30 September 2026; working-source changes based on revision `c34be571`.

When a correct guess is projected locally, the player can immediately type into
the successor. A lost, expired or invalid confirmation previously restored the
original submitted answer and discarded that successor typing permanently.
Race Session now retains the successor's letters, selected slot and question
history privately while presenting the original answer during error recovery.

An owned resume restores this candidate only if the server confirms the same run,
riddle identity, position and answer length. It merges the complete authoritative
hint set into the recovered letters and moves selection off any newly revealed
slot. The server's returned run supplies all scores, clocks and penalties; the
provisional candidate supplies input only. Failed or foreign reads retain the
candidate for another recovery attempt. A successful read consumes it even if
authority confirms no advancement or a different question.

Fresh input after rollback, another play mutation, terminal reconciliation,
navigation, rematch, account changes and disposal invalidate the candidate. It is
never persisted or transferred to another account. No locale files or provider
contracts change.

Public-session regressions exercise recovery with concurrent hints, repeated read
failure, full delivery expiry, foreign reads, question/position/length mismatch,
no advancement and fresh input/hint/rematch/account intent. Browser regression
cases lose or corrupt a genuine correct guess after the player types `clo` into
the projected next question. They verify rollback to `piano`, one resume read,
restored `clo`, and continued typing to `clock` without another submission.
Companion browser checks cover hint confirmation, paid rollback and full delivery
expiry. The previous paid rollback flow was moved into the focused browser helper
to retain the main test file's maintainable size.

Reproduce required checks and record completion through the existing dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-successor-draft-recovery.json
```

The recorder requires a stable source snapshot throughout verification. Accepted-
revision CI separately synchronizes completed work to the live dashboard. The
repository-wide TSDoc audit currently reports six undocumented declarations in
concurrent Reddit test work; none belong to this successor-recovery change.

Verification passed: 172 race tests, portal types, four selected injected browser
tests, all seven isolated target builds, artifact dependency verification and the
maintainable-file-size check. Browser checks include both lost and malformed guess
cases and the full 30-second delivery deadline. The recovered successor screenshot
was inspected. Continued typing is checked without imposing casing on the game's
existing keyboard paths. Scoped diff checks passed.

The completion command passed every declared check but withheld its dashboard
receipt because the shared source changed during verification. No completion row
was recorded for this task; rerun the saved command against a stable revision.
