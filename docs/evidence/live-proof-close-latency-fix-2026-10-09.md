# Cancel optional multiplayer proof waits on close

Closing while initial draft recovery awaited an optional immutable guess receipt previously delayed return to the multiplayer intro by roughly 2.31 seconds in the controlled browser probe. `LiveRaceGame` now gives that lookup its own AbortController. Close aborts the optional local wait after recording close intent, while the authoritative joined-seat acceptance continues and submits its normal idempotent leave request. Account retirement is forwarded from the existing delivery lifetime signal; the bridge listener is removed on settlement, and only the exact lookup can clear the current proof ref.

The derived browser probe holds the proof unresolved until after intro is visible. It then releases the late result and verifies gameplay stays closed, the checkpoint is absent, and exactly one leave was sent. Chromium production measures 66.0 / 67.7 ms at widths 390 / 1280; Firefox development measures 75.0 / 76.4 ms. Each engine passes two journeys / 20 checks. The latency guard is 750 ms, leaving local rendering/automation variation while excluding the two-second optional deadline. These are controlled local UI measurements, not live provider or cloud timing claims.

All 3237 enabled client tests pass across 316 suites (96 gated tests / 16 suites skipped). TypeScript, TSDoc (27916 declarations / 1230 files), and file-size gates pass. All six isolated client builds and Devvit pass. Initial Jest resources stay at 576558 bytes against the unchanged 576716.8-byte gate. Source manifests verify 2561 inputs unchanged across the builds. The complete Chromium production multiplayer draft/receipt regression passes 22 journeys / 176 checks, covering accepted/rejected and missing/malformed/timed-out proof, competing writer, close, owner replacement and consumed input.

Reports are under `artifacts/live-proof-close-latency-fix-2026-10-09/`; builds remain in `/tmp/live-proof-close-latency-fix-builds-20261009/`. All jobs in this checkpoint are terminal. No commit, push or deployment occurred.

Remaining for this fix: complete the other engine/mode close checks and appropriate broader recovery regression coverage, inspect final rendered evidence, archive output hashes and dependency inventories, and remove only the owned temporary build root. The broader reliability/performance/playability/latency goal remains active.

## Verified completion

All four close engine/mode combinations pass at widths 390 and 1280: eight journeys / 80 observations and assertions. The same controlled close measurements span 56.3–77.0 ms. The complete broader recovery suite passes Chromium production and Firefox development, each 22 journeys / 176 checks, including account retirement, proof timeouts and competing writers. The review packet totals 52 journeys / 432 checks. No new failures justified further repetition of the already-passing client suite or builds.

The 390px Chromium wrong-guess recovery screenshot was inspected: authoritative wrong-guess history, recovered next-draft cells and mobile controls remain visible. No visible text changed. Selected terminal source still matches all 2561 inputs. 1316 final build files were archived byte-for-byte with SHA-256 hashes, plus six target dependency inventories; only the owned `/tmp/live-proof-close-latency-fix-builds-20261009/` root was removed. All jobs are terminal.

This completes the reproduced optional-proof close delay fix. It cancels only the local optional wait, not the provider request or authoritative leave flow. No deployment, commit or push occurred. The broad goal remains active; a separate follow-up can examine how optional recovery affects time to first multiplayer input, without weakening immutable proof requirements or losing recovered drafts.
