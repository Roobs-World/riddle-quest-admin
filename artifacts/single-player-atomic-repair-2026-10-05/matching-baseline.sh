#!/usr/bin/env bash
set -uo pipefail
report=artifacts/single-player-atomic-repair-2026-10-05
trap 'cp "$report/service-after.ts" firebase-functions/src/gameplay/firestoreService.ts; cp "$report/completion-after.ts" firebase-functions/src/gameplay/completeGameLogic.ts' EXIT
cp "$report/service-before.ts" firebase-functions/src/gameplay/firestoreService.ts
cp "$report/completion-before.ts" firebase-functions/src/gameplay/completeGameLogic.ts
export SINGLE_PLAYER_REPAIR_TRACE=1 GCLOUD_PROJECT=demo-riddle-quest-atomic-repair FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 NODE_OPTIONS=--experimental-vm-modules pnpm_config_verify_deps_before_run=false
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand --silent=false --verbose=true src/__tests__/singlePlayerCompletionRepairLatency.test.ts > "$report/latency-baseline.log" 2>&1
latency_status=$?
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand --testNamePattern 'preserves concurrent progression, purchase and rewards' src/__tests__/firestoreService.test.ts > "$report/matching-concurrency-red.log" 2>&1
concurrency_status=$?
printf 'baseline latency exit %s; concurrency exit %s\n' "$latency_status" "$concurrency_status"
[[ "$latency_status" == 1 && "$concurrency_status" == 1 ]]
