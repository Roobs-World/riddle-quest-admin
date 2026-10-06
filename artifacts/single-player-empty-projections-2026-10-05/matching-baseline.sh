#!/usr/bin/env bash
set -uo pipefail
report=artifacts/single-player-empty-projections-2026-10-05
trap 'cp "$report/completion-after.ts" firebase-functions/src/gameplay/completeGameLogic.ts' EXIT
cp "$report/completion-before.ts" firebase-functions/src/gameplay/completeGameLogic.ts
export SINGLE_PLAYER_REPAIR_TRACE=1 SINGLE_PLAYER_PROJECTION_TRACE=1 GCLOUD_PROJECT=demo-riddle-quest-empty-projections FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 NODE_OPTIONS=--experimental-vm-modules pnpm_config_verify_deps_before_run=false
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand --silent=false --verbose=true src/__tests__/singlePlayerCompletionRepairLatency.test.ts > "$report/latency-baseline.log" 2>&1
latency_status=$?
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand --silent=false --verbose=true --testNamePattern 'reads a profile only for required' src/__tests__/completeGameTransaction.test.ts > "$report/projection-baseline.log" 2>&1
projection_status=$?
printf 'latency baseline exit %s; projection baseline exit %s\n' "$latency_status" "$projection_status"
[[ "$latency_status" == 1 && "$projection_status" == 1 ]]
