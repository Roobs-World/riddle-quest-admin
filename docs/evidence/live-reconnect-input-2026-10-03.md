# Live PvP draft continuity — 3 October 2026

Players can now compose another attempt while an original guess, hint, skip, or recovery observation awaits delivery. Submit and paid command admission still obey the original pending command and canonical refresh barriers. A held wrong-answer receipt no longer freezes the native keyboard or erases the newer word when it arrives.

## Changes

- `LiveRaceGame` keeps the original submitted draft separately from the editable attempt. Retries send the original payload and request ID; local typing cannot alter the retained command or score.
- Draft reconciliation uses the ticket, run, locale, riddle ID, position, and answer width. Same-question counter updates preserve unsent input; question advances, seat changes, and terminal views discard it. Confirmed hints replace only revealed cells and repair a newly locked cursor.
- A definitively rejected guess restores its original word only if no newer letter edits occurred. Deliberately erasing a newer draft counts as intent. Ignored input, cursor movement, and observations do not advance the letter revision.
- Closing disables editing immediately while the original owned seat is retired. Late receipts cannot reopen another account's board.
- Observations that change no letters or focus retain draft reference identity. The existing isolated elapsed-time clock remains intact.
- A pre-existing commerce interaction test now runs its hook-using component under the React server renderer. An existing translation-hook declaration received its missing TSDoc comment. These repairs do not change gameplay or copy.

The initial exploration used the retired `RaceSession` path. Mounting the actual entry established that current human PvP uses `LiveRaceGame`; the exploratory source edits were removed before this implementation. Retired experiments remain only as text evidence under `artifacts/multiplayer-resume-input-2026-10-03`.

## Verification

Evidence is under `artifacts/live-reconnect-input-2026-10-03`.

| Check | Result |
| --- | --- |
| Exact original-source control | Fails native editing while a wrong-answer receipt is held |
| New draft unit cases | 17 passed |
| Full portal units | 2,707 passed, 296 suites; 121 browser cases intentionally skipped in this run |
| Types and TSDoc | Passed; 25,101 documented declarations across 1,135 files |
| Injected current live entry | 708 checks across 60 journeys; development and production React with Strict Mode wrappers |
| Viewports | 390×568, 390×844, 1280×844 |
| Native Firefox MCP | Verified held original command retries, independent `TEST` typing, preserved draft after acknowledgment, and one explicit solve |
| Existing live delivery coverage | Late/lost replies, exact retry IDs, bounded outages, stale question rejection, newer delivery ownership, opponent victory, and terminal reconnect passed at desktop and mobile sizes |
| Existing responsiveness check | Player command bypassed a hung poll in 100 ms at each size |
| Existing clock isolation check | Four gameplay renders over 2.1 seconds at each size; visible clock advanced |
| Built artifact journeys | 22 passed across four suites |
| Six target builds and audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Build source inventory | All 762 paths and content hashes unchanged throughout final verification |

The new injected journeys cover wrong answers, hints, skips, same-question polls, transient retries, definitive rejection, untouched submission recovery, deliberately empty drafts, account replacement, and closing during delivery. They check native composition, command admission, original payload ownership, canonical penalties and counts, and page errors. The package script `test:live-reconnect-input:browser` runs both React modes and is included in the existing browser chain.

Firefox used the active MCP connection and two actual mounted player entries against the local fixture. During the intentionally prolonged hold, all three deliveries retained the original `ZZZZ` word and one request ID while `TEST` remained locally editable. Acknowledgment preserved `TEST` without awarding a solve; native Submit then sent a new request ID and advanced the score once. Only the verification tabs and fixture process were closed; the original Firefox tab remained open. The Firefox proof preceded the final reference-identity optimization, which the final 708-check matrix covers.

These are local and injected transport results, not production network measurements. No deployed multiplayer server, provider SDK contract, economy authority, visible translation key, or target policy changed. No deployment or commit was performed. The wider improvement goal remains active.
