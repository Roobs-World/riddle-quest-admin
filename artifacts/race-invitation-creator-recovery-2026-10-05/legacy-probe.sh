#!/usr/bin/env bash
set -euo pipefail
report='/home/craig-beswetherick/Documents/riddle-quest/artifacts/race-invitation-creator-recovery-2026-10-05'
destination='/home/craig-beswetherick/Documents/riddle-quest/firebase-functions/src/__tests__/race/raceInvitationCreatorRecovery.it.test.ts'
fixture="$report/legacy-regression.fixture.ts"
if [[ -e "$destination" ]]; then printf 'Legacy diagnostic destination already exists; preserving it.\n' >&2; exit 2; fi
cp "$fixture" "$destination"
cleanup() { if cmp -s "$fixture" "$destination"; then rm "$destination"; else printf 'Legacy diagnostic source changed; preserving it.\n' >&2; fi; }
trap cleanup EXIT
cd /home/craig-beswetherick/Documents/riddle-quest/firebase-functions
export pnpm_config_verify_deps_before_run=false NODE_OPTIONS=--experimental-vm-modules
pnpm exec firebase emulators:exec --project demo-race-invitation-creator-recovery --config "$report/emulator.json" --only firestore,database "pnpm exec jest --config $report/legacy-probe.config.cjs --runInBand"
