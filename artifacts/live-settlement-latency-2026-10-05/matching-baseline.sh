#!/usr/bin/env bash
set -uo pipefail
report=artifacts/live-settlement-latency-2026-10-05
trap 'cp "$report/service-after.ts" firebase-functions/src/race/raceLiveService.ts' EXIT
cp "$report/service-before.ts" firebase-functions/src/race/raceLiveService.ts
LIVE_SETTLEMENT_TRACE=1 GCLOUD_PROJECT=demo-riddle-quest-settlement FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 NODE_OPTIONS=--experimental-vm-modules pnpm_config_verify_deps_before_run=false pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand src/__tests__/race/raceLiveSettlementLatency.test.ts > "$report/matching-baseline.log" 2>&1
