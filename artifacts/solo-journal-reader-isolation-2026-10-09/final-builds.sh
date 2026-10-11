#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/solo-journal-reader-isolation-2026-10-09
task_build_root='/tmp/solo-journal-writer-final-builds-20261009'
export JEST_BUILD_OUT_DIR="$task_build_root/jest"
export FACEBOOK_BUILD_OUT_DIR="$task_build_root/facebook"
export REDDIT_BUILD_OUT_DIR="$task_build_root/reddit"
export YOUTUBE_BUILD_OUT_DIR="$task_build_root/youtube"
export NETFLIX_BUILD_OUT_DIR="$task_build_root/netflix"
export YAHOO_BUILD_OUT_DIR="$task_build_root/yahoo"
for target in jest facebook reddit youtube netflix yahoo; do
 command="build:$target"
 if [[ "$target" == youtube ]]; then command=build:youtube:fixture; fi
 pnpm --dir packages/portal "$command" > "$report/final-build-$target.log" 2>&1
 printf '%s build passed\n' "$target"
done
pnpm --dir packages/reddit-app exec vite build --outDir "$task_build_root/reddit-server" > "$report/final-build-reddit-server.log" 2>&1
printf "Devvit server build passed\n"
