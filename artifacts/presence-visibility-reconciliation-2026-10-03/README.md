# Presence reconciliation preparation evidence

See [the evidence report](../../docs/evidence/presence-visibility-reconciliation-2026-10-03.md) and [the staging runbook](../../docs/presence-visibility-reconciliation.md).

`emulator-final.log` records 37 real tests, including the actual Node 22 operator CLI using current compiled production services. `cli-final.log` records six parser/CLI tests. Initial results and audit diagnostics are retained. The separate compiled directory and copied CLI are under the owned `~/.cache/riddle-quest-review/presence-visibility-reconciliation-20261003/` cache; the test compares the CLI copy with its source before execution.

`diagnostic/build-targets.cjs` builds/audits each of the six private output directories and never deploys. The manifest records hashes and explicitly denies hosted reconciliation, global inventory coverage, old-writer drain, frozen source/build provenance and upload eligibility. No production permission data or player inventory is included.
