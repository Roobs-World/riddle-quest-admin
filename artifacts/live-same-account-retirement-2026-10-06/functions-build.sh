#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
pnpm --dir firebase-functions exec tsc -p tsconfig.json --outDir /tmp/live-same-account-functions-builds-7fzirg03/lib
pnpm --dir firebase-functions exec rimraf /tmp/live-same-account-functions-builds-7fzirg03/lib/__tests__ /tmp/live-same-account-functions-builds-7fzirg03/lib/__mocks__
