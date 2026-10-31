# Current-source multiplayer verification

On 13 October 2026, the repaired authentication selection passed every declared scenario. The separate retained invitation selection also passed every declared scenario. Structured Jest assertion reports establish coverage for each alternative rather than accepting one passing test for the entire selection.

The live lifecycle browser check passed at 1280px and 390px. It verified cleanup after confirmed, pending and expired joins, and countdown behavior after forward and backward one-hour wall-clock changes.

Exact source digest, revision, command arguments, structured assertion output and log hashes are retained in `artifacts/development-checks/current.json` under `authentication-harness-extraction-browser`, `retained-authentication-entry-paths` and `verify-live-race-lifecycle-browser`. The 18 verification guard tests also passed.

The stale authentication scenario gap reported on 11 October is resolved for these selections. The broad live PvP recovery completion plan remains incomplete. Its other checks require current-source evidence before whole-plan completion can be recorded. Provider publication, review submission and listing visibility remain separate gates.

All seven isolated target builds, portal type checks and artifact dependency evidence checks passed on the same source digest after these browser checks. This includes the six required targets and GameSnacks.

## Full-plan run on 13 October 2026

Every declared command in `live-pvp-seat-recovery.json` has a passing result in the current report. The isolated Node 22 backend coverage gate passed 1,897 tests across 115 suites. The full client and core suites, retained browser inventory, live gameplay, delivery, lifecycle, seat recovery, isolated builds and target dependency checks passed.

Whole-plan completion was not recorded. A concurrent workspace process committed changes during the first run, invalidating its source binding. During the rerun, the saved backend coverage log changed after recording, so its bytes no longer match its output hash. Rebuilding target dependency manifests after the broad run also invalidated the artifact bindings for earlier checks. The exact log mismatch is saved in `integrity-audit.json` beside this handoff.

Pause the process modifying verification evidence, then rerun the complete plan with isolated builds first. Preserve exact logs, revision and artifact bytes through completion recording. Do not replace the recorded hashes with hashes of modified logs or treat the broad passing results as an intact completion receipt.
