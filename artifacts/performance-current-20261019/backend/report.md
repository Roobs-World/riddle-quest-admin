The bounded 40-candidate public waiting poll is faster in the local Firestore measurement. Median elapsed time fell from 61.83 ms to 30.65 ms across five alternating runs per implementation. Every request selected the expected eligible human opponent, retained the original deck and left the account balance unchanged.

| Public waiting poll | Baseline median, range in ms | Candidate median, range in ms | Successful requests |
| --- | --- | --- | --- |
| Empty queue | 14.50, 12.53 to 14.92 | 12.11, 11.00 to 12.66 | 5 of 5 per side |
| One eligible rival | 20.83, 20.08 to 21.58 | 19.05, 18.59 to 20.01 | 5 of 5 per side |
| 40 candidates, first 39 blocked | 61.83, 51.50 to 92.49 | 30.65, 26.87 to 37.64 | 5 of 5 per side |
| 40 blocked candidates | 43.72, 42.23 to 52.41 | 22.94, 21.26 to 34.39 | 5 of 5 per side |

The baseline issued five separate SDK read calls for every candidate. The candidate batches canonical player pointers, account deletion markers and reciprocal block records into one read call, and reads the same public profile fields in a second batch. It also reuses the owner's pointer snapshot already read in the same transaction. In the 40-candidate matching case this reduced SDK read calls from 210 to 11. Document-read attempts fell only from 249 to 248. Both sides queued seven writes and used one transaction attempt in every sample. The optimization primarily removes request overhead and duplicate pointer work. These counts do not establish a reduction in billed Firestore reads.

A separate CPU profile covered a 96.16 ms baseline request and captured 95.24 ms of samples. gRPC and HTTP/2 functions accounted for 19.94 ms of self samples, Firestore SDK functions 4.54 ms, protobuf and integer decoding 5.29 ms, deck grapheme validation 6.33 ms, idle time 21.10 ms and garbage collection 2.96 ms. The recorded read timeline contains 210 completed SDK calls. This identifies request processing and its awaited storage reads as the main removable work. Batching preserves all 40 candidate deck and authority checks, so those checks and the remaining Firestore operations still limit the candidate. The profile includes instrumentation and is excluded from the comparison table. Raw samples and call timings are in `baseline-profile.json`; `profile-summary.json` records the exact matching CPU profile filename and timing window.

The timer surrounds the awaited production `updateLiveRaceForUser` call, including its real transaction commit and response validation. It excludes fixture writes and post-request correctness reads. Both implementations use compiled Functions code on Node 22.23.1, the same real Admin SDK, the same loopback Firestore emulator, one warm process, and synthetic 32 KiB account documents. Profile reads retain the existing `username`, `level`, `avatarUrl` field mask. A warm-up precedes the comparisons. Each scenario runs baseline, candidate, baseline, candidate until each side has five observations. All 40 timed requests succeeded. The machine had eight available cores; one-minute load was 0.47 before and 0.67 after. Browser profiling did not overlap this window. `comparison.json` retains every observation, CPU usage, transaction attempt, read and write count.

The canonical pool queue remains one shared document with a 40-seat bound and a 10-second lobby lease. This measurement uses sequential requests, so it does not measure cloud latency, cold starts, client transport, cross-instance contention, throughput, hosted Jest authentication or SMS delivery. Existing transaction concurrency regressions provide correctness evidence separately. No production latency or SLO claim follows from these local samples.

The two snapshots in `baseline-source/` match the SHA-256 values recorded before editing. `baseline-hashes.txt` and `candidate-hashes.txt` identify the source and compiled modules used in the comparison. The rebuild helper creates isolated source copies in `/tmp`, restores the baseline snapshots only in the baseline copy, and compiles both without overwriting `firebase-functions/lib`. `rebuild-manifest.json` confirms that both rebuilt JavaScript modules match the original measured module hashes.

Run from the repository root. The following commands reproduce the environment. Read the two generated library paths from the manifest for the benchmark arguments.

```bash
node scripts/performance/compile-live-race-variants.cjs > artifacts/performance-current-20261019/backend/rebuild-manifest.json
NODE_PATH="$PWD/firebase-functions/node_modules" GCLOUD_PROJECT=demo-riddle-quest-queue-performance FIRESTORE_EMULATOR_HOST=127.0.0.1:8199 XDG_CONFIG_HOME=/tmp/rq-perf-backend-20261019/config /home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node firebase-functions/node_modules/firebase-tools/lib/bin/firebase.js emulators:start --only firestore --project demo-riddle-quest-queue-performance --config artifacts/performance-current-20261019/backend/emulator.json
```

In a second terminal, replace the two `/tmp` library paths with the corresponding manifest paths. The helper refuses a non-loopback host or any project other than its exact dedicated demo project. Its fixture reset deletes only that emulator project.

```bash
NODE_PATH="$PWD/firebase-functions/node_modules" GCLOUD_PROJECT=demo-riddle-quest-queue-performance FIRESTORE_EMULATOR_HOST=127.0.0.1:8199 /home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node scripts/performance/live-race-queue-benchmark.cjs baseline=/tmp/rq-perf-backend-20261019/baseline/lib candidate=/tmp/rq-perf-backend-20261019/candidate/lib output=artifacts/performance-current-20261019/backend/comparison.json
```

For the separate profile, use the same environment, add `--cpu-prof --cpu-prof-dir=artifacts/performance-current-20261019/backend` before the script path, replace `candidate=...` with `profile=true`, and choose a separate output path.

Targeted ESLint for the two runtime files and the public waiting regression file passed. Backend TypeScript checking passed. Five actual Firestore suites passed all 94 tests in 27.923 seconds, covering public waits and concurrent joins, masked account payloads and retry freshness, private invitations and creator recovery, and frozen deck compatibility. The two added public queue cases reject candidates with a missing account profile or an account deletion marker. `regressions.json` and `regressions.log` contain the passing run. The first launcher used the repository working directory and failed before loading any test because ts-jest resolved `tsconfig.json` there. `regressions-launch-failed.*` retain that setup failure. The passing command uses the Functions working directory.

```bash
cd firebase-functions
NODE_PATH="$PWD/node_modules" GCLOUD_PROJECT=demo-riddle-quest-queue-performance FIRESTORE_EMULATOR_HOST=127.0.0.1:8199 /home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node node_modules/jest/bin/jest.js --config ../artifacts/performance-current-20261019/backend/jest.config.cjs --runInBand --runTestsByPath src/__tests__/race/raceLivePublicWait.it.test.ts src/__tests__/race/raceLiveIdentityPayload.it.test.ts src/__tests__/race/raceLiveInvitation.it.test.ts src/__tests__/race/raceLiveCreatorRecovery.it.test.ts src/__tests__/race/raceLiveDeckCompatibility.it.test.ts --json --outputFile=../artifacts/performance-current-20261019/backend/regressions.json
```

Some suites use their established `demo-riddle-quest-live` identity rather than the benchmark's demo identity. Both run only on the isolated local port 8199. The emulator logged its single-project advisory for those suites. No production project or player record was accessed. No backend deployment or game activation occurred.

A separate bounded check submitted eight actual new-player joins concurrently through the final compiled service. All eight succeeded, creating eight owned tickets and four human matches with each account assigned exactly once. Balances remained unchanged. Firestore invoked 15 transaction attempts, including seven retries. The whole batch took 3.540 seconds; individual joins took 2.084 to 3.540 seconds. This was one functional diagnostic while the parent agent ran build and completion checks, not a before/after latency benchmark. Load average was 1.09 on eight cores. `concurrent-joins.json` contains all outcomes and attempts. The initial version of this fixture seeded 45 questions and all joins were correctly rejected by the existing 30-question category bound before creating seats. `concurrent-joins-fixture-failed.*` retain that setup error; the passing run uses 30 authored questions without changing the production bound.

To repeat that diagnostic, use the benchmark command with `concurrent=true` and a separate output path. It performs actual content queries and joins, then checks the persisted tickets, matches and balances. Its counters cover transaction calls and include discarded retry mutations; content reads outside the transaction are excluded. These results prove eventual pairing for this bounded group and do not establish production contention or throughput limits.

The emulator received a graceful SIGINT after all runs. `emulator-stop.json` records the exact owned demo process and stop time.
