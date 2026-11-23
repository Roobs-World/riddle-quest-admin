# GitHub Actions cost controls

GitHub Actions is disabled for `Grindhead/riddle-quest` at repository level as of 23 November 2026. All four registered workflows are also manually disabled, including the abandoned temporary CI probe. This prevents old branches and newly added workflow files from starting hosted runners. Local builds and uploads do not use GitHub Actions runners.

## What consumed the allowance

The retained Actions history for 1–23 November contains 106 Riddle Quest runs, all from `production-readiness.yml`. Their completed jobs used approximately 2,670 runner minutes. There were 76 failed runs, 28 cancelled runs and two successful runs. These are execution-time measurements, not an invoice or the account's exact charged usage.

An account-wide scan of 27 accessible owned repositories found about 2,952 runner minutes in total. Riddle Quest contributed approximately 90.5%; Portfolio contributed 277 minutes and the-hive contributed five minutes. The temporary probe had no November runs.

The primary causes were:

- Older workflow versions ran full verification on every branch push. Android pushes alone caused 58 retained runs. The default `main` branch still carries this older automatic definition.
- The newer Jest workflow used the commit SHA in its concurrency key. New pushes therefore did not cancel superseded push runs.
- Four browser shards each ran common authentication, purchase recovery, retained race, Facebook, mobile soak and Firestore rules checks. Only the dedicated browser command list actually used the shard selector.
- Each shard's Facebook preflight rebuilt the target and repeated the Facebook browser suite after that suite had already run.

Browser E2E steps accounted for approximately 1,807 minutes, or 67.7% of Riddle Quest's recorded execution time. A single recent run used [over 360 runner minutes](https://github.com/Grindhead/riddle-quest/actions/runs/45172788278). November 23 accounted for approximately 1,546 minutes.

## Controls in source

The three maintained workflows now accept only `workflow_dispatch`. They have no push, pull request, tag or schedule trigger. Every job requires the `jest` branch and an explicit `confirm_runner_usage=true` input. The checkbox defaults to false.

Readiness now runs the complete browser suite once, without a matrix. It waits for both workspace and Functions checks to pass before starting browsers. Facebook packaging reuses the build and browser results from that run rather than repeating the suite. Superseding readiness runs share a branch-based concurrency group and cancel older runs. Completion receipts expire after seven days rather than 90.

The hosted jobs retain finite timeouts. Maximum combined runner times are 445 minutes for readiness, 360 for a Jest release and 760 for an all-platform release. These are upper bounds, not expected usage. A deliberate full verification can still consume substantial allowance. Deployment workflows preserve in-flight releases rather than cancelling them halfway through an upload.

`node scripts/ci-security.mjs` statically rejects automatic triggers, missing confirmation gates, SHA-based concurrency and repeated readiness matrices. It runs without starting workflows or tests.

## Inspect usage without spending runner allowance

```sh
node scripts/report-actions-usage.mjs --month 2026-11
node scripts/report-actions-usage.mjs --repo Grindhead/Portfolio --month 2026-11
```

The reporter uses the existing `gh` login and only reads API history. It sums actual completed job durations, excludes queue time and skipped jobs, includes available rerun attempts, and reports missing or zero-duration records. `--json` provides machine-readable output. The [retained summary](evidence/github-actions-usage-2026-11-23.json) records the measurement and largest runs.

GitHub's timing endpoint returned zero billable milliseconds for runs with substantial execution, and the account billing API rejected the current token because it lacks the `user` scope. No account budget, billing plan or invoice total was changed or inferred. Deleted runs, inaccessible repositories and older runs rerun in this month can be absent from the report.

## Before deliberately using hosted runners again

Keep repository Actions and its workflows disabled until a hosted run is explicitly requested. Before permanently enabling workflows, migrate or remove the automatic workflow definitions on `main` and stale branches. A corrected file on `jest` does not protect other refs that still contain automatic triggers.

For an authorized hosted run, review the selected workflow's maximum runner time, use the `jest` branch and explicitly confirm allowance usage. Keep local verification as the default. Enabling a workflow or launching it is not part of an ordinary push.

At account level, review [GitHub billing budgets](https://github.com/settings/billing/budgets) and configure an Actions budget with **Stop usage when budget limit is reached** plus threshold alerts. An alert-only budget does not stop spending. These controls require account billing access and were not changed in this investigation. See [GitHub's budget instructions](https://docs.github.com/en/billing/how-tos/set-up-budgets).
