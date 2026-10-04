#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/host-bridge-retirement-2026-10-04
pnpm --dir packages/portal exec jest --config jest.config.cjs --runInBand > "$report/portal-unit.log" 2>&1
pnpm --dir packages/portal check:types > "$report/portal-types.log" 2>&1
pnpm check:tsdoc > "$report/tsdoc.log" 2>&1
printf 'Unit, type and documentation gates passed\n'
