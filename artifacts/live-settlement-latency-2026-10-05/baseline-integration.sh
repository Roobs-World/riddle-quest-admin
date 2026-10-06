#!/usr/bin/env bash
set -uo pipefail
report=/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-settlement-latency-2026-10-05
service=/home/craig-beswetherick/Documents/riddle-quest/firebase-functions/src/race/raceLiveService.ts
trap 'cp "$report/service-after.ts" "$service"' EXIT
cp "$report/service-before.ts" "$service"
NODE_OPTIONS=--experimental-vm-modules pnpm_config_verify_deps_before_run=false pnpm exec jest --config "$report/integration.config.cjs" --runInBand --testNamePattern 'serializes rival completion with deletion and cannot create another economic grant' > "$report/deletion-original-control.log" 2>&1
