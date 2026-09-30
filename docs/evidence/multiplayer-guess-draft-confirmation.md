# Multiplayer guess draft confirmation

30 September 2026; working-source changes based on revision `c34be571`.

Guess confirmation previously identified attempts by content ID alone. If a deck
repeats a riddle ID at a later position, an automatic skip could carry the original
answer history and fresh input into the successor. Confirmations preserving an
editable draft also failed to merge additional server-revealed letters, allowing
the visible draft and authoritative hints to disagree.

Race Projection now compares content identity, deck position and answer length
for submitted history and currently displayed input independently. A confirmation
preserves typing only for the exact displayed question and answer shape. A changed
question clears its history and initializes a fresh answer. History for a confirmed
unchanged question comes from the original submission checkpoint.

Race Session validates complete reveal sets before consuming the guess checkpoint,
using the same private validation as paid hint confirmation. Out-of-range or repeated
slots preserve rollback and successor recovery. Valid hints replace only revealed
slots, preserve other typing and move selection off any newly revealed slot.

Public-session regressions cover current/successor hint merging, automatic skips
with repeated content IDs, changed question/position/length confirmations, and
invalid reveal rollback followed by authority read recovery. The browser test uses
delayed real guess confirmations with injected reveal metadata to verify visible
hint merging, continued keyboard input, invalid-response rollback and one-read
recovery without resubmission. Existing successor recovery and paid-hint browser
checks remain in the saved completion command.

No locale files, server scoring or platform contracts change. All provider
restrictions continue to be checked through isolated builds and dependency audits.

Reproduce the checks and update the existing dashboard with:

```sh
pnpm development:complete docs/development-tasks/race-guess-draft-confirmation.json
```

The recorder requires a stable source snapshot throughout verification. Accepted-
revision CI separately synchronizes completed work to the live dashboard. The
repository-wide TSDoc audit currently reports six undocumented declarations in
concurrent Reddit test work; none belong to this guess-confirmation change.
