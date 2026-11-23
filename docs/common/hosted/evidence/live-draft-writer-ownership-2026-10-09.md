# Live draft writer ownership — 2026-10-09

A replacement game instance can save the same partial answer and cursor as an older instance within the same millisecond. The previous checkpoint encoded only content, binding and wall time, making those writes byte-identical. The older instance could then overwrite or clear the replacement's checkpoint despite exact-byte observation checks.

The local record now includes a unique writer ID created for each mounted checkpoint owner. Identical content and time remain distinguishable between writers. The old instance's observed bytes no longer match the replacement, so its later edits and retirement cannot mutate replacement persistence. Writer IDs are presentation revisions; they are not commands, purchase identities, scoring authority or transport request receipts. They remain stable within one writer, so ordinary unchanged saves still avoid duplicate writes.

The reader strictly checks the additional field. Earlier unreleased development records without a writer ID are rejected safely; they contain no authoritative progress to migrate. Existing account, ticket, run, language, question, accepted-guess, cell, cursor and expiration checks remain in place. No visible copy, server protocol or adapter contract changed.

## Proof

- A new fixed-clock ownership test failed against the exact archived previous helper: one failed, 13 passed. The failure showed the older instance overwriting replacement bytes. After the fix it checks both stale editing and stale cleanup.
- 33 focused tests pass. Full client suite: 3,085 tests pass; 96 browser-gated tests remain skipped in that command and are covered separately below.
- Eight additional injected UI journeys hold Date.now constant, type a partial word, acquire the checkpoint with a replacement writer, continue typing in the stale screen and close it. They confirm identical saved time/content, distinct writer IDs, responsive local typing and byte-exact preservation of the replacement checkpoint after both edits and cleanup.
- The preceding recovery and rejection matrix was rerun. Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: 64 total journeys, 368 checks. This includes the eight ownership journeys, eight reload journeys and 48 boundary journeys.
- Types, TSDoc and maintainable file sizes pass. All six isolated target artifacts plus the Devvit server rebuild successfully. Rendered Jest/Reddit suites pass 22 checks; the Facebook fixture passes one.
- 2,506 selected inputs match before, terminal and verified source manifests. All jobs completed. 1,299 target/server files and seven dependency inventories were archived, then owned build roots and inventories removed. The Facebook harness removed its own temporary fixture.

Run `python3 artifacts/live-draft-writer-ownership-2026-10-09/verify.py` from the repository root to check source hashes, exact prior helper, browser observations, test/build logs, archived artifacts and cleanup.

The browser fixtures supply canonical authority and use the injected legacy transport. These results do not establish production reload frequency or modern provider transport behavior end to end. No production deployment or latency improvement is claimed. The broader game improvement goal remains active.
