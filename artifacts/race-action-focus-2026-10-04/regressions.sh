#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/race-action-focus-2026-10-04
for check in race-ime-dialog live-immediate-submit native-composition-delivery native-composition-retirement playable-action-focus; do
 pnpm --dir packages/portal "test:$check:browser" > "$report/regression-$check.log" 2>&1
 printf '%s passed\n' "$check"
done
