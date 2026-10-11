# Current matchmaking benchmark, 9 October 2026

The repaired benchmark ran successfully against the current backend, compiled with pinned Node 22.23.1 into an isolated temporary output. Its dedicated loopback Firestore namespace is `demo-riddle-quest-match`. All six scenarios and four successful replay phases passed, with five observations per phase (50 lookups). The capped scenario produced the expected five search-budget failures; these are counted outcomes, not omitted errors.

Healthy dense and sparse searches each used a median 20 canonical document read attempts and six transaction read batches. Replays used nine reads and three batches. Exclusion-heavy searches used 119 reads and 22 batches; freshness searches used 167 reads and 69 batches. This directs further investigation toward repeated eligibility validation in difficult pools, rather than tiny in-memory lookup groups.

Median local elapsed times were 46.66 ms dense, 20.25 ms sparse, 77.90 ms exclusions, 9.96 ms empty, 182.81 ms capped, and 140.55 ms freshness. These are synthetic warm-process emulator observations. There was no alternating before/after experiment, cloud cold start, browser transport or representative production network. They establish current regression checks, not a speedup or production SLO.

Evidence is in `artifacts/matchmaking-current-2026-10-09`: terminal run log, exact JSON results, compiled file hashes, and a post-run source inventory. The inventory was taken after execution and is not a pre-run freeze proof. All four allocated emulator ports were confirmed closed after terminal exit 0; the owned temporary compiled output was then removed. No deployment or player-data mutation occurred.
