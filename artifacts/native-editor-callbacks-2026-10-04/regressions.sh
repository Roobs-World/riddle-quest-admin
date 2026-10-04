#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/native-editor-callbacks-2026-10-04
for mode in development production; do
 env COMPOSITION_DELIVERY_REACT_MODE="$mode" COMPOSITION_DELIVERY_REPORT_DIR="$report/regression-composition/$mode" node packages/portal/scripts/verify-native-composition-delivery-browser.mjs > "$report/regression-composition-$mode.log" 2>&1
 env NATIVE_RETIRE_REACT_MODE="$mode" NATIVE_RETIRE_REPORT_DIR="$report/regression-retirement/$mode" node packages/portal/scripts/verify-native-composition-retirement-browser.mjs > "$report/regression-retirement-$mode.log" 2>&1
 env NATIVE_NAVIGATION_REACT_MODE="$mode" NATIVE_NAVIGATION_REPORT_DIR="$report/regression-navigation/$mode" node packages/portal/scripts/verify-native-navigation-tail-browser.mjs > "$report/regression-navigation-$mode.log" 2>&1
done
printf 'Native editor regression gates passed\n'
