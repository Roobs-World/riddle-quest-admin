#!/usr/bin/env bash
set -euo pipefail
report="$PWD/artifacts/classic-question-preparation-2026-10-05"
for variant in original fixed; do
 if [[ "$variant" == original ]]; then artifact="$PWD/artifacts/live-signal-watchdog-2026-10-05/built/jest"; else artifact="$report/built/jest"; fi
 BUFFERED_TIMING_ARTIFACT_DIR="$artifact" BUFFERED_TIMING_REPORT_DIR="$report/verified-native-counter-$variant" BUFFERED_TIMING_RUNS=2 BUFFERED_TIMING_CPU_RATE=12 BUFFERED_TIMING_DOM_OBSERVER=0 BUFFERED_TIMING_LONG_OBSERVER=0 BUFFERED_TIMING_MEASURE_ONLY=1 node "$report/native-counter-probe.mjs" > "$report/verified-native-counter-$variant.log" 2>&1
 printf '%s passed\n' "$variant"
done
