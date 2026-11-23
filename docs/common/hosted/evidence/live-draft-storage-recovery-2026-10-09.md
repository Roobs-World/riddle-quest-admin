# Live draft storage recovery ownership — 2026-10-09

When the initial storage observation was unavailable, the checkpoint owner had no observed revision. The previous save guard nevertheless allowed it to adopt any record that appeared when storage became readable. An independent writer's checkpoint could be silently overwritten, then removed by the older instance's close.

The guard now distinguishes unknown storage from a verified empty key. After an initially unavailable read, a successful empty read permits checkpointing to resume. A previously unseen non-empty record does not grant overwrite or cleanup ownership. Local input and server gameplay continue normally while that record remains protected. This conservative behavior intentionally does not claim an unseen record automatically.

## Evidence

- The new two-case storage-recovery test failed before the fix only for the competing checkpoint: one failed, 15 passed. The empty-key recovery case already passed. After the change both pass; 35 focused tests pass across draft and storage behavior.
- Full client suite: 3,087 tests pass; 96 browser-gated tests skipped there, with rendered checks run separately.
- Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: 80 injected journeys, 456 assertions. Sixteen new journeys exercise temporary storage denial followed by either an independent checkpoint or an empty key. They verify responsive typing, preservation through old-instance edits/close, and successful persistence into a verified empty key. The preceding reload, stale binding, account, denied storage, explicit close and writer-identity matrices remain green.
- Types, TSDoc and maintainable file sizes pass. All six isolated target artifacts and Devvit server build successfully. The rendered Jest/Reddit suites pass 22 checks; the separate Facebook fixture passes one.
- 2,506 selected source inputs match before, terminal and verified manifests. The production change is one ownership guard; its focused tests are the only other changed source input. All verification processes reached terminal results. 1,299 cohort files and seven dependency inventories are archived; owned target build roots and inventories are absent. The Facebook harness removed its own fixture.

## Fixture timing correction

The first aggregate browser run stopped in Firefox production's accepted-guess case. A live poll had legitimately renewed the local checkpoint after the fixture's other-tab wrong guess. The recovered `te` draft was therefore valid, while the fixture had assumed its checkpoint still used the old accepted-guess count. The failure log and observations are retained as `firefox-production-boundary.first.log` and `firefox-production-boundaries.first.json`.

The stale-record case now deliberately injects the captured older checkpoint before the reloaded app starts, so it proves rejection of a known stale binding independently of poll timing. That entire boundary matrix was rerun. The new storage fixture was also tightened: making storage readable and publishing the competing checkpoint occur in one browser evaluation, preventing a poll from observing the empty key in between. All storage cases were rerun with that version. The missing final writer-ownership run also completed. No production source changed during these fixture corrections or verification runs.

Run `python3 artifacts/live-draft-storage-recovery-2026-10-09/verify.py` from the repository root to check final source hashes, the exact previous helper, baseline and final observations, tests/builds, archived artifacts and cleanup.

These injected HTTP fixtures prove current client behavior under supplied canonical authority; they do not establish production reload frequency or modern provider transport behavior end to end. No deployment or production latency improvement is claimed. The broader reliability, performance and playability goal remains active.
