# Live checkpoint read deduplication — 2026-10-09

Unchanged authoritative multiplayer refreshes no longer read checkpoint storage. The previous save path checked storage before discovering that its content already matched the acknowledged checkpoint. The revised path compares semantic content first; only real mutations proceed to storage revision verification.

The cache is populated only after a successful write and exact readback. Failed writes and unavailable acknowledgements cannot suppress retries. Content includes canonical account/seat/run/language/question/accepted-guess binding, writer ID, cells and cursor. Every actual write still checks its observed revision; cleanup still reads and compares exact bytes. Skipping a read-only no-op therefore does not grant ownership of another writer's data.

## Verification

- The new read-work regression failed against the exact previous helper: one failed, 17 passed. Five unchanged saves performed five unnecessary reads. The companion unverified-write test already passed and remains green.
- 37 focused tests pass. The full client suite passes 3,089 tests; 96 browser-gated tests skipped there were handled separately through rendered checks.
- The same injected poll observation as the preceding work diagnosis now records zero reads, zero writes and zero removals across five requested unchanged refreshes per journey. Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: eight work journeys. Total observed reads fell from forty to zero; draft contents remain intact. This is a measured work reduction, not an end-to-end latency measurement.
- All preceding checkpoint recovery, stale-binding, hint/cursor, account, explicit-close, competing-writer, same-millisecond replacement and temporary storage recovery checks remain green. Total injected browser scope: 88 journeys, 520 assertions.
- Types, TSDoc and maintainable file sizes pass. All six isolated target artifacts and the Devvit server rebuild successfully. Rendered Jest/Reddit suites pass 22 checks; Facebook's separate fixture passes one.
- 2,506 selected source inputs remained frozen through verification. All jobs reached successful terminal results. 1,299 target/server files and seven dependency inventories were archived, then owned build roots and inventories removed. The Facebook harness removed its own fixture. No visible text, adapter contract or server protocol changed.

Run `python3 artifacts/live-checkpoint-read-deduplication-2026-10-09/verify.py` from the repository root. It verifies current source hashes, the exact previous helper, baseline and final results, raw zero-call observations, build logs, archived artifacts and cleanup.

The comparison baseline is `artifacts/live-checkpoint-poll-work-2026-10-09/work-summary.json`: eight journeys, five reads each, no mutations. The same fixture and browser configurations were used after the fix; the test expectation changed to zero reads.

The fixtures supply canonical authority and injected legacy transport. These checks do not measure production player latency or modern provider transport end to end. No deployment occurred. The broader game improvement goal remains active.
