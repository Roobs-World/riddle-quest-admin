# Presence permission ordering evidence

See [the evidence report](../../docs/evidence/presence-visibility-ordering-2026-10-03.md) for the reproduced failure, changes, validation and hosted release gates.

`red.log` and `red-confirmed.log` demonstrate the original grant-after-block failure against real emulator rules. `green-initial.log` and `green-expanded.log` show the focused fix. `emulator-final.log` contains the final 29-test regression run, and `functions-unit-final.log` contains the 1,581-test broad run with Jest's VM-module flag. Intermediate invocation/fixture failures remain for accurate diagnostics.

The owned `diagnostic/build-targets.cjs` builds and audits six outputs in the private cache and never deploys. `diagnostic/compiled-runtime.cjs` loads compiled modules without invoking handlers. `manifest.json` records evidence and source hashes, while explicitly denying frozen build provenance, upload eligibility and hosted acceptance.
