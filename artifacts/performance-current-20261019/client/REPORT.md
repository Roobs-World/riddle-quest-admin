# Client matchmaking performance

Healthy waiting now performs fewer background requests and React commits. Five alternating 13-second measurements per side show 13 observations before and 3 afterward in every sample. This is the expected effect of changing reconciliation from one second to four seconds for visible modern public and private waiting seats with connected push. Legacy search, countdown, disconnected push and racing retain their previous cadence.

| Measurement per 13-second warm waiting interval | Before, median and range | After, median and range |
| --- | --- | --- |
| Successful HTTP observations | 13, 13–13 | 3, 3–3 |
| React root commits | 13, 13–13 | 3, 3–3 |
| Local storage reads | 13, 13–13 | 3, 3–3 |
| Main thread task time | 198.0 ms, 184.4–210.1 | 56.9 ms, 53.3–60.6 |
| JavaScript execution time | 22.6 ms, 19.5–24.5 | 7.3 ms, 6.2–7.8 |
| Style recalculations | 733, 731–733 | 185, 185–186 |
| Signal to second animation frame after countdown DOM commit | 53.1 ms, 50.9–61.4 | 49.8 ms, 47.7–59.5 |

Main thread work fell about 71% in this fixture. Push response ranges overlap, so there is no measured responsiveness speedup. All ten reported intervals had zero long tasks, layout passes, storage writes and browser errors. Every received view passed the actual core schema; the countdown showed the joined human opponent. This verifies real component work and successful observations rather than measuring rejected requests or a skipped render.

The limiter for redundant work is the observation cadence. Each accepted observation parses a view, commits the live screen and reads the current lobby checkpoint. The one-second search-ring CSS transition also restarts when its server-time projection advances. The style counts fall with fewer observations. CPU profiles taken in separate, excluded 4.5-second pilot runs are mostly idle, so they do not justify a broader rendering refactor. No storage rewrite was needed because unchanged checkpoints already suppress writes.

Two short control measurements per scenario, one for each version, used 4.5-second intervals. Private waiting fell from four observations to one and still entered countdown after an immediate signal. Legacy search and disconnected public waiting both retained four observations per interval. These controls establish scheduling behavior, not repeated latency estimates. The configured steady-state request cadence falls 75%; the finite 13-second windows contain 13 and 3 completed requests because of their endpoints.

Conditions were Chromium 153.0.8010.12, React 19.3.0, Vite 8.3.1, Node 24.17.0, a 390×844 mobile viewport, touch enabled and four-times CPU throttling. Both sides used the same production React compiler, minification, foundation styles, race lobby/gameplay styles and loaded local fonts. A local HTTP fixture imposes 20 ms before returning each successful authoritative-shaped view. The measurement excludes cold startup. React's commit hook counts commits without altering the compiled component source. Main thread metrics come from Chrome's Performance domain. The frame marker uses two requestAnimationFrame callbacks after the relevant DOM commit, rather than a hardware display measurement.

The machine had eight CPU cores. At final measurement start the load averages were 2.33, 1.25 and 0.71 following completed builds and tests; other agents held CPU-heavy work during the reported samples. Baseline and candidate alternated five times to distribute remaining drift. Separate profiling pilots are excluded from the table. The results isolate client costs and are not hosted Jest, real SMS, mobile hardware or Firestore production latency evidence.

Raw measurements, all controls, versions and source hashes are in [results.json](results.json). Separate CPU profiles are [baseline-pilot.cpuprofile](baseline-pilot.cpuprofile) and [candidate-pilot.cpuprofile](candidate-pilot.cpuprofile). The immutable original helper is [liveRacePolling.before.ts](liveRacePolling.before.ts), with [source-before.sha256](source-before.sha256), [source-after.sha256](source-after.sha256) and [client-change.diff](client-change.diff). The baseline helper SHA-256 is `02adcbea97cb14554ce3efa7ad40a75a61e4783283bd33b43d47bde055564c36`; the candidate is `2c5c19dab154d004610c06c16bde966914b6612a236abdbeb22761e3c578cd31`.

The first profiling attempt omitted the race styles and mobile viewport metadata. Its logs, screenshots and CPU profiles remain under [discarded-unstyled](discarded-unstyled/); none of its timings appear in the results above. Styled smoke screenshots were reviewed before the final run. The final waiting screenshots are [public](candidate-public-push-waiting-390.png) and [private](candidate-private-push-waiting-390.png).

Focused polling unit checks passed 14 of 14. The production scheduling browser harness passed 79 checks across healthy/disconnected/hidden connections, held commands, backoff, watchdog recovery, retirement, account replacement, subscription failure and terminal cleanup at 390×568. It verified native answer submission, retained request identities, prompt foreground recovery and bounded timers. Its 11 diagnostic samples are not additional assertions. Details are in [scheduling.log](scheduling.log) and [scheduling/observations.json](scheduling/observations.json).

Reproduce from `packages/portal` with `node scripts/measure-current-live-wait-performance.mjs`. The script requires the retained original helper and checks that its candidate matches current production source. It starts only a local fixture server, uses independent browser contexts and makes no deployment, provider, SMS or production account changes.
