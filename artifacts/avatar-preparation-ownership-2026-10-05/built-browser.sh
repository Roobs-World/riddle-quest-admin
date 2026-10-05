#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
export PORTAL_USE_EXISTING_BUILD=1 PORTAL_BROWSER_TESTS=1
export PORTAL_JEST_BUILD_DIR='/tmp/riddle-avatar-owner-builds-0nuqz306/jest' PORTAL_REDDIT_BUILD_DIR='/tmp/riddle-avatar-owner-builds-0nuqz306/reddit'
pnpm --dir packages/portal exec jest --config jest.config.cjs --runInBand src/play/__tests__/hostedBrowser.jest-playwright.test.ts src/play/__tests__/profileTour.jest-playwright.test.ts src/reddit/__tests__/redditBrowser.jest-playwright.test.ts
