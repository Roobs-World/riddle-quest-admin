#!/usr/bin/env bash
set -euo pipefail

runtime_dir="/tmp/riddle-agent-runtime"
mkdir -p "$runtime_dir"
chmod 700 "$runtime_dir"

XDG_RUNTIME_DIR="$runtime_dir" exec agent-browser "$@"
