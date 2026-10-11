#!/usr/bin/env bash
set -euo pipefail
TOURNAMENT_LOOKUP_MODE=development TOURNAMENT_LOOKUP_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/lookup-development" node packages/portal/scripts/verify-live-tournament-lookup-deadline-browser.mjs > "artifacts/live-tournament-share-retirement-2026-10-08/lookup-development.log" 2>&1
echo "lookup-development passed"
TOURNAMENT_SHARE_MODE=development TOURNAMENT_SHARE_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/share-development" node packages/portal/scripts/verify-live-tournament-share-browser.mjs > "artifacts/live-tournament-share-retirement-2026-10-08/share-development.log" 2>&1
echo "share-development passed"
TOURNAMENT_LOOKUP_MODE=production TOURNAMENT_LOOKUP_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/lookup-production" node packages/portal/scripts/verify-live-tournament-lookup-deadline-browser.mjs > "artifacts/live-tournament-share-retirement-2026-10-08/lookup-production.log" 2>&1
echo "lookup-production passed"
TOURNAMENT_SHARE_MODE=production TOURNAMENT_SHARE_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/share-production" node packages/portal/scripts/verify-live-tournament-share-browser.mjs > "artifacts/live-tournament-share-retirement-2026-10-08/share-production.log" 2>&1
echo "share-production passed"
SHARE_PREPARATION_MODE=development SHARE_PREPARATION_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/preparation-development" node packages/portal/scripts/verify-live-tournament-share-preparation-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/preparation-development.log" 2>&1
echo "preparation-development passed"
SHARE_PREPARATION_MODE=production SHARE_PREPARATION_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/preparation-production" node packages/portal/scripts/verify-live-tournament-share-preparation-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-tournament-share-retirement-2026-10-08/preparation-production.log" 2>&1
echo "preparation-production passed"
