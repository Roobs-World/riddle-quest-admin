#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/live-context-owner-2026-10-06
pnpm --dir packages/portal check:types > "$report/types-final.log" 2>&1
node scripts/audit-tsdoc.mjs > "$report/tsdoc-final.log" 2>&1
node scripts/audit-file-sizes.mjs > "$report/sizes-final.log" 2>&1
pnpm --dir packages/portal check:target-boundaries > "$report/boundaries-final.log" 2>&1
node scripts/audit-security-config.mjs > "$report/security-final.log" 2>&1
