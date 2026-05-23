# Git History Secret Purge Plan

Last updated: 2026-05-23

The repository now stops tracking the exposed local secret files and ignores future copies. Historical commits still contain those files until a coordinated history rewrite is completed.

## Files To Purge

- `.env`
- `firebase-functions/.env.default.backup`
- `firebase-functions/.runtimeconfig.json`
- `firebase-functions/qwordly-admin-sdk.json`

## Recommended Command

Run from a clean clone after coordinating with everyone who has a checkout:

```sh
git filter-repo --force \
  --path .env \
  --path firebase-functions/.env.default.backup \
  --path firebase-functions/.runtimeconfig.json \
  --path firebase-functions/qwordly-admin-sdk.json \
  --invert-paths
```

Then force-push protected branches according to the repository policy:

```sh
git push --force-with-lease --all
git push --force-with-lease --tags
```

## After The Rewrite

1. Every collaborator must reclone or hard-reset to the rewritten history.
2. Rotate all credentials anyway; history purging does not undo exposure.
3. Run a secret scanner against the rewritten history.
4. Keep the index removals and ignore rules from this remediation branch.

## Why This Was Not Run In-Place

This workspace has a dirty tree with unrelated user changes, and `git-filter-repo` is not installed locally. Running a history rewrite here would risk disrupting the active worktree. Use a fresh clone for the purge.
