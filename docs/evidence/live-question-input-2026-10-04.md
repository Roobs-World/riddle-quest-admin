# Native composition ownership across live questions — 4 October 2026

A live PvP question could advance while the player was composing text in the device editor. The visible draft reset correctly, but the persistent native input retained its old composition. Ending that composition wrote the old text into the new clue. The minimized reproduction confirmed this through the actual `RaceTo10Game` entry with two human fixture seats: a held correct-answer receipt advanced the question, then the old composition inserted `にほん` into the new four-letter draft.

`RaceGameplay` now keys its native editor by run ID, locale, riddle ID, position, and answer width. Each question gets a fresh editor and composition lifetime. Same-question attempts, hints, polls, clock changes, and ordinary letter edits retain the existing editor. The small `useRaceAnswerEditor` hook preserves focus during replacement only if the retiring editor owned focus; it does not take focus from another control. Ref callbacks stay stable across ordinary renders. Server scoring, penalties, command ownership, and the preceding pending-draft policy are unchanged.

## Evidence

Artifacts are under `artifacts/live-question-input-2026-10-03`; reproduction began before local midnight. `verification-summary.json` records source hashes and results.

| Check | Result |
| --- | --- |
| Original-source control | Fails the exact stale-composition assertion: new draft becomes `にほん` instead of remaining empty |
| New current-entry transition matrix | 438 checks across 42 journeys, development and production React with Strict Mode wrappers |
| Transition scenarios | Correct answer, explicit skip, fifth wrong answer, another-tab advance, same-question wrong answer, same-question hint, and advance while another control owns focus |
| Viewports | 390×568, 390×844, 1280×844 |
| Preceding live draft/retry regression | 708 checks passed in both React modes |
| Solo/live keyboard lifetime regression | 376 checks passed in both React modes |
| Full portal units | 2,707 passed across 296 suites; 121 browser cases intentionally skipped in this run |
| Types and TSDoc | Passed; 25,105 documented declarations across 1,136 files |
| Built game journeys | 22 passed across four suites |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Final source inventory | All 763 paths and content hashes stable through verification |

The matrix checks that the original composition remains in the editor while its question is current, old commits cannot populate a new clue, same-question commits still work exactly once, focus follows only its own replacement, and retired software-delete events cannot remove new letters. Fresh native typing and deletion continue working. The fifth-wrong-answer fixture follows the server's existing automatic skip and penalty rule. Assertions run at the mounted UI seam rather than duplicating hook internals in a shallow unit test.

The active Firefox MCP connection independently verified the new-question boundary at 390×568 with two mounted human entries. After an injected composition and an authoritative fixture advance, the old editor was disconnected, the replacement had empty text and answer cells, and focus remained in the replacement. Replaying the old composition events left the new clue empty. Native MCP typing entered `TE`; native Backspace removed one letter, and a retired editor's software-delete event did not remove another. No page errors or unhandled rejections were reported. `firefox-mcp-proof.json` includes raw results, parsed observations, and assertions. Verification tabs and the owned fixture process were closed, leaving the original Firefox tab open.

Composition events were injected through the browser DOM; this is not certification of every operating system's IME or software keyboard. Native fresh typing and Backspace were exercised through Firefox MCP. No backend authority, provider SDK, visible translation key, or target policy changed. No deployment or commit was performed. The overall improvement goal remains active.
