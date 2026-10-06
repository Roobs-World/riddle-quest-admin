# Playable frozen decks before new live matches — 5 October 2026

New public opponents, private invitation acceptances and bot fallback now validate the complete original frozen deck before creating a match. Public matchmaking skips incompatible candidates and removes their IDs from the shared queue, allowing a healthy newcomer to search or pair with a valid waiting player. Original owner tickets and pointers survive so cancellation remains available. Private previews classify incompatible new entries as unavailable; new private or bot match creation rejects with structured data loss before writes.

The real SDK baseline reproduced 33 failures across 42 cases. Countdown responses concealed the current prompt and accepted incompatible first or future questions. Public pairing copied the retained opponent's deck even after successfully validating the newcomer's fresh catalog. Shape corruption could also raise an unstructured error and interrupt healthy matchmaking.

The new live guard requires exactly 15 ordered questions with unique question and canonical identities. The existing shared compatibility guard continues to support historical recordings containing 1–15 questions. It now validates the locale, array shape, answer type and raw 128-unit bound before Unicode work. Original clue, answer and fingerprint bytes are preserved; no catalog substitution or automatic archive repair occurs. Discovery converts only structured compatibility data loss into exclusion and propagates unrelated failures.

Guard placement preserves previously accepted journeys. Existing join and invitation recovery, owned cancellation, private expiry cleanup, current prompt delivery, terminal settlement and reward replay execute before or outside new-match checks. Account deletion's shared run constructor remains usable. Validation uses transaction-local retained snapshots and adds no database reads, clock changes or identity projections.

Verification passed:

- 1,674 backend unit tests across 135 suites, including five new bounded-work cases. The matching baseline had four failures and one decomposed-Unicode control pass. Oversized 129- and 4,096-unit source answers now reject before normalizing those strings; malformed answer types and locales return structured data loss.
- 454 real-SDK loopback emulator tests across 29 suites. The 42 new cases cover malformed deck shapes, incompatible first/future answers, a future oversized clue, bad-candidate pruning, selection of a healthy candidate behind it, private readiness and atomic rejection, bot rejection, cancellation, identical-request retry after explicit fixture repair, original French NFD and Hindi decks, normalized scoring and exact receipt replay, accepted recovery, authoritative forfeit settlement and terminal no-regrant. All 42 also pass on the pinned Functions Node 22 runtime.
- 374 core tests across 38 suites and 121 focused portal tests across seven suites.
- Eight injected built-browser gameplay checks across three suites, including the existing buffered transition assertion below 100 ms.
- Core/backend/portal types, downstream backend lint and the documentation audit of 26,154 declarations across 1,172 files.
- Six isolated builds and artifact audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. YouTube used the incomplete-content fixture path; this is not release certification.

Compiled core packages were synchronized before freezing 2,379 selected inputs. All final checks used unchanged inputs. The 1,300 built files, six dependency inventories and SHA-256 manifests are preserved before deleting only the owned temporary build root and matching inventories. All 23 parent verification jobs reached terminal results, and the owned emulator ports closed.

Diagnostic corrections are retained: an initial forfeit assertion incorrectly expected a clean-run badge (250 instead of 200 coins); the documentation command initially used the wrong name; six fixture declarations needed comments; and the first core test command used a nonexistent .cjs configuration. The corrected checks passed. The source changes do not rely on those failed checks as evidence.

[Evidence directory](/home/craig-beswetherick/Documents/riddle-quest/artifacts/race-live-deck-compatibility-2026-10-05). The improvement goal remains active. Internal whitespace in race answers and recorded invitation readiness remain separate audit candidates. Transaction-local validation is reviewed in source; this pass does not claim a forced SDK retry with content changing between attempts.
