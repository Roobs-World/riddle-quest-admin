# Live invitation creator recovery audit

The current live game already preserves creator cancellation when an unpaired private lobby contains incompatible question content. Four new Firestore SDK regression cases verify this behavior. This pass changes tests only; it makes no production behavior or latency claim.

The cases create a healthy private lobby through `joinLiveRaceForUser`, then corrupt only a future question: whitespace in the answer, a 129-unit answer, a 2,001-unit clue, or a duplicated canonical identity. Owner preview remains `own`; fresh recipient preview becomes `unavailable`. A different authenticated player cannot cancel the seat. The owner can leave without parsing or repairing the deck. Repeating the same leave command changes neither the ticket version nor published signal versions. Original corrupted content, both account profiles and balances remain unchanged; no match or additional ticket is created.

## Scope correction

An earlier real SDK diagnostic reproduced four failures in the retained recorded-race API: malformed recording metadata returns `unavailable/invalid` without creator cancellation facts, including after a cancellation. Its separate cancellation authority still succeeds. The exact red fixture, observations and guarded replay script remain in the artifact directory. That finding is **unfixed**.

Routing inspection showed that `RaceTo10Game` mounts `LiveRaceEntry` and `LiveRaceGame`, with `LiveRaceInvitationCard` for incoming live invitations. The recorded `RaceSession` controller and `RaceTo10View` are retained code rather than the mounted game. Consequently, this pass adds coverage to the current live path and does not change inactive recorded UI or expand its DTO.

## Verification

- Four live SDK cases passed with the real Admin SDK against owned loopback Firestore/Realtime Database emulators; the same four passed on pinned Functions Node v22.23.1.
- Backend TypeScript and ESLint passed. TSDoc passed for 26,380 declarations across 1,180 files. An initial TSDoc failure for two test declarations was corrected before source freeze.
- All six isolated client builds and their artifact audits passed. YouTube used the incomplete-content fixture; this is not release certification.
- The frozen manifest contains 2,387 inputs. All 2,386 inputs from the preceding catalog validation pass are byte-identical; the sole addition is the four-case test. That prior pass's 1,722 backend unit tests and 641 SDK cases are reused evidence, **not freshly rerun totals**. No client or UI source changed, and no new browser observation is claimed.
- All 1,300 built files and six target dependency inventories were preserved with SHA-256 verification before removing only the owned temporary build root and its matching metadata. Owned emulator ports were closed. Fourteen tracked jobs reached actual terminal results.

The Firefox MCP information probe returned “Process (pid=535620) unexpectedly closed with status 0”; it supplied no browser observation. No unrelated browser process was restarted.

## Evidence and continuation

Artifacts: `artifacts/race-invitation-creator-recovery-2026-10-05/`. `verify.py` checks the source manifest, fresh SDK logs, observations, build bytes, cleanup and terminal job ledger. `legacy-probe.sh` intentionally replays the unresolved recorded API diagnostic and refuses to overwrite an existing source test; it is not a green gate.

The next active-game candidate is a delayed join receipt after close or account retirement. `LiveRaceGame` currently sends a single best-effort leave and swallows a failed transport delivery. A mounted injected browser reproduction is needed before changing that cleanup lifecycle. The overall improvement goal remains active.
