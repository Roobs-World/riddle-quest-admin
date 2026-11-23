# Host-confirmed loss recovery, 3 October 2026

A reload after the granted sixth attempt could restore six accepted wrong answers as an editable, nonterminal round. With no current provider save, the game neither recovered the loss nor delivered its completion. The focused reducer regression returned `gameOver: false`; the injected mounted game exposed five editable cells. Both failures are retained in `artifacts/authority-loss-recovery-2026-10-03`.

The shared terminal proof now recognizes a loss only when the issued host history contains all six valid, ordered, nonwinning attempts, Continue was granted, and no Continue decision remains. Existing win validation stays strict. Five wrong attempts, incomplete histories, bad cells and guesses following an earlier win cannot prove exhaustion. Victory presentation and Classic successor promotion retain their win-only helper.

The loaded loss survives stale provider restoration and journal rollback, including a rollback carrying an older copy of the same issued question. Reconciliation retires only a terminal root whose queued guesses and paid action all belong to that exact riddle, session and mode. Other identities and successors stay intact; a loss cannot advance Classic. Pending terminal completion blocks journal delivery. The existing completion owner saves the loss, retries with its original request identity, and asks authority for a fresh retry after acknowledgment.

The new browser verifier mounts the actual `PlayHostApp` and `createHostedPlaySession`, uses real guesses and a real Continue charge through the existing fake host authority, then supplies its complete accepted history. Native preparation withholds the sixth wrong-answer receipt and reloads the actual journal created by the game. The fixture explicitly caches completion because the fake authority itself does not implement idempotent receipts; it issues a distinct empty retry session after that receipt. These checks establish client recovery and routing, rather than production network timing or backend idempotency.

Verification:

- 24 new unit regressions; the full portal suite passes 2,690 tests across 295 suites (121 browser-gated checks skipped by that invocation).
- 696 injected assertions per React mode: three viewport sizes, missing/stale/foreign/forged saves, no journal, a native lost sixth receipt, and an already-charged Continue journal. Native lost-reply preparation runs by default through `test:authority-loss-recovery:browser`, which is included in the full game browser chain.
- Existing winning-journal recovery passes 690 production assertions; buffered rollback passes 420 production assertions; cold-draft recovery passes 366 assertions per React mode.
- 22 built game journeys pass against the final target artifacts.
- Active Firefox MCP confirms native typing cannot reopen the exhausted round, the owned journal is cleared, completion retries retain one request ID, and completion counts one game without a win, reward or Classic advance. Native Submit subsequently sends one guess only to the newly issued retry session. The balance remains 250 after the original 50-coin Continue charge. Raw responses and parsed, asserted observations are saved in `firefox-final-verified.json`.
- Portal type checking and the TSDoc audit pass: 25,049 documented declarations across 1,133 files.
- All six target builds and artifact audits pass. Jest initial resources remain 0.53 MB within its 0.55 MB budget. Locale audits pass for all 16 locales; no visible copy or provider dependencies were added.

Before-source snapshots, red controls, screenshots, native journals, command logs, owned-file hashes and the 760-file build input inventory are retained under the artifact directory. Existing shared-tree work was preserved. Owned Firefox pages and fixture servers were closed after verification. Nothing was committed, pushed or deployed. The broader improvement goal remains active.
