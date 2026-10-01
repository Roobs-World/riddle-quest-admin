# Multiplayer receipt projection authority

30 September 2026 local development evidence. Scope is named HTML5 platform
artifacts, excluding standalone web/PWA releases. This change does not alter
visible UI text, translations or production data.

## Reproduced replay contradictions

Eleven public-interface demo-emulator regressions failed before correction.
Genuine accepted hint receipts were damaged with individually valid transport
fields, then retried after a later skip advanced the owned run. Replay returned
altered ghost finish/history, challenge/start identity, clue text, current answer
or length, preload answers/hints, selected hint letters and revealed hint letters.
Request digests and shape validation did not bind those copied gameplay fields to
the immutable source. A retry could therefore receive gameplay incompatible with
the original accepted race, even without a second charge.

## Immutable facts remain owned

The receipt module now validates copied gameplay against the owned run's immutable
challenge/rivalry identity, recorded start/preparation metadata, rules, ghost
timing/history and authored question deck. Current prompt and preload content
resolve by historical position rather than today's active question. Supplied
evaluation must use the authored answer and locale; server-only policy never
allows injected local evaluation. Reveals must occupy unique real answer slots,
and remaining guesses/hint availability must agree with the retained rules.
Selected hint data must be authored and, while the prompt is present, included
in its accepted reveal set.

Both newly accepted replies and cached replays pass these checks before commit.
Corrupt gameplay cannot commit privacy scrubbing, repeated charges or other
dependent writes. Explicit repair returns the original accepted projection,
including concurrent duplicates, rather than replacing it with today's progress.

Copied names and avatars remain privacy presentation, independent of gameplay
authority. Deletion can neutralize identity while retaining the original ghost,
hint and accepted response clock. Supported unversioned receipts can retain the
old one-hint limit when no immutable rules snapshot was recorded; versioned or
snapshot-backed rules cannot downgrade. Missing historical clock fields and
optional old preload hints remain supported.

## Verification

Thirteen public-interface emulator cases cover the original eleven contradictions,
an authored but unrevealed selected hint, and deletion/repair ordering. Each
corruption case checks unchanged run/account/receipt state, explicit repair,
concurrent exact replay and supported unbound historical replay after advancement.
Pure receipt cases additionally cover old one-hint metadata, immutable rivalry and
preparation expiry, presentation changes and server-only evaluation exclusion.
The focused compatibility gate passed 56 cases before the final additional reveal
case; the complete recorder verifies all final source.

Stable-source recording uses
`docs/development-tasks/race-receipt-projection-authority.json`: Node 22 backend and
operator safeguards, full race coverage, types/lint, client recovery, seven isolated
artifacts and dependency evidence, security, scalability, size and TSDoc checks.
Its receipt updates the local development dashboard. The comprehensive reliability
goal remains active, and production rollout requires separate evidence.
