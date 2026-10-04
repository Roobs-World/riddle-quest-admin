#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env COMPOSITION_DELIVERY_REACT_MODE="$mode" COMPOSITION_DELIVERY_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-native-composition-delivery/$mode" pnpm --dir packages/portal exec node scripts/verify-native-composition-delivery-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-native-composition-delivery-$mode.log" 2>&1
done
printf 'native-composition-delivery passed\n'
for mode in development production; do
 env NATIVE_RETIRE_REACT_MODE="$mode" NATIVE_RETIRE_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-native-composition-retirement/$mode" pnpm --dir packages/portal exec node scripts/verify-native-composition-retirement-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-native-composition-retirement-$mode.log" 2>&1
done
printf 'native-composition-retirement passed\n'
for mode in development production; do
 env NATIVE_CANCELLED_REACT_MODE="$mode" NATIVE_CANCELLED_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-native-cancelled-keys/$mode" pnpm --dir packages/portal exec node scripts/verify-native-cancelled-keys-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-native-cancelled-keys-$mode.log" 2>&1
done
printf 'native-cancelled-keys passed\n'
