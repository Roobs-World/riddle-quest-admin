# Terminal pending-journal recovery — 3 October 2026

Verified progress on the active reliability, performance, playability and latency goal. Reloading a host-confirmed winning round now retires its obsolete pending-play journal before it can replay guesses or paid actions. The broader goal remains active.

## Reproduction and cause

The mounted game originally sent a journaled guess even though its loaded host history already proved that the round was won: **one outgoing guess instead of zero**. The initial quick reproduction took less than one second. The final native reproduction submits through the real game, lets its authority accept the answer, withholds that reply, observes the actual durable journal, and reloads with a missing or older provider checkpoint.

The final red control substitutes only the captured original recovery hook and still fails on the unnecessary replay. The current hook passes the same quick journey's 25 assertions. Run the portal verifier with `AUTHORITY_TERMINAL_JOURNAL_ONLY=1 AUTHORITY_TERMINAL_QUICK=1`; add `AUTHORITY_TERMINAL_RECOVERY_BASELINE_DIR` pointing to this pass's artifact directory to reproduce the original hook. Both logs and the original source are retained.

Journal restoration was delivering its retained requests without checking the host's terminal proof. The reducer already protected the winning board, but that protection did not retire transport retries and pending action bookkeeping.

## Change

`isPendingPlayJournalSupersededByWin` reuses the existing bounded host-winning-history checks. It requires the journal's question and every retained guess or paid action to match the exact riddle, session token and game mode. Provider or journal colours cannot establish a win. Journals containing issued successors remain intact.

The mounted recovery owner checks this condition before restoring or delivering a journal, including an already mounted journal when new host history arrives. It clears the obsolete journal, releases its own lease, cancels retry and renewal timers, and clears pending delivery references and counters. The existing completion path still checkpoints intent, awaits acknowledgement and controls progression and rewards. No account or economy grant was moved to the client.

This removes demonstrated unnecessary requests for completed rounds; it does not claim a measured production network-latency improvement. No visible text, locale key or provider SDK was added. The six target isolation requirements remain unchanged.

## Verification

The [verification summary](../../artifacts/terminal-journal-recovery-2026-10-03/verification-summary.json) contains source fingerprints and process cleanup status.

- **2,615 portal unit checks in 294 suites**, with 120 skipped. Eleven new boundary cases cover attempts 1, 5 and 6, paid actions, missing/wrong host proof, foreign round identities and journals containing later questions.
- **2,058 injected browser assertions:** 690 native lost-reply/reload assertions in each development and production React mode; 582 existing production terminal-recovery assertions without a journal; and 96 guest terminal-checkpoint assertions.
- The new matrix covers first-, fifth- and paid sixth-attempt wins; missing, stale, foreign and forged provider checkpoints; and 390×568, 390×844 and 1280×844 viewports. It observes actual native-created journals before reload, zero replayed guesses/charges afterwards, retirement before held completion acknowledgement, once-only progression, reward collection where required, native Next and playable new rounds. The paid preparation uses the real Continue control.
- **22 built journeys in four suites** cover guest/authenticated Reddit, hosted play, profile guidance and queued coin actions, including interrupted Continue recovery.
- Native Firefox at 390×568 independently submits PIANO, observes its accepted answer and withheld-reply journal, reloads to the confirmed win with no journal or replay, releases completion once, and advances natively to example 2. Native Q typing succeeds. Independently checked observations are retained in `firefox-verified.json`.
- All six isolated artifacts build and pass their audits. Jest remains at **0.53 MB initial resources against the unchanged 0.55 MB limit**. Types, TSDoc (24,954 declarations), whitespace checks and the React recovery review pass.

These are injected-provider checks. Reload preparation reconstructs the fixture authority with actual service calls independently of the browser journal; it does not claim a live remote backend restart or production provider verification. An early native fixture run restored the stale cursor before preparation and submitted rotated letters. Preparation was corrected to start fresh before applying the stale-save condition on reload; the product recovery change was not altered for that fixture error.

All owned validation processes are terminal. The owned fixture server was stopped and the owned Firefox tab closed, preserving the original about:blank tab. No commit, push or deployment was performed.

Next investigation: safely reconciling only the completed prefix of a journal that also contains later issued questions. This pass deliberately retains those required later deliveries.
