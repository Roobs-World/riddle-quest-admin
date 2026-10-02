# Race skip progress — 2 October 2026

The live race now retains the shared engine's completed-riddle count instead of subtracting skips. Manual skips and automatic skips after exhausted guesses advance the counter and the current question together. Hints retain their time penalty; submitting a correct hinted answer advances progress. The scoreboard says “Riddles completed” in all 16 supported locales, and the race instructions describe the adjusted-time result.

Verification against the combined workspace changes:

- 46 backend tests passed: live transactions, scoring and transport latency. Cases cover repeated skip requests, rival progress, restoring the current question, tenth completion and one reward grant.
- 28 focused portal presentation tests passed.
- Injected browser harness with the real local Firestore authority passed at 1280×900 and 390×844: skip/attempt exhaustion, both counters, hinted submission, reload, adjusted-time waiting and settlement, bot fallback, and no browser errors.
- All six isolated production artifacts passed their build and artifact audit: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo.
- Focused backend lint and whitespace checks passed.

Logs and screenshots are under `artifacts/race-skip-progress/`. The final browser run is `browser-final.log`; build results are `build-results.json`.

Implemented and verified locally. No production deployment was performed.
