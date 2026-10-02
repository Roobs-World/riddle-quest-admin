# Local Live PvP safety evidence

Human-opponent block/report controls are restored through Facebook and Reddit's existing authenticated transports. Jest does not opt into the new live controls. See [the source evidence report](../../docs/evidence/live-race-safety-2026-10-02.md).

`browser-baseline.log` and `callable-baseline.log` reproduce the missing surface/contract. `emulator-initial.log` also retains an initial fixture cleanup failure: it used the wrong deletion-guard collection name. The fixture now imports the production tombstone collection constant; no production guard was relaxed. `emulator-final.log` passes all 11 tests, including the actual signed Reddit gateway and deletion lease. The provider browser logs pass and retained mobile/desktop screenshots verify the expanded layout.

`build-results.json`, `build-*.log` and `audit-*.log` bind checks to six owned output directories under `/home/craig-beswetherick/.cache/riddle-quest-review/live-race-safety-20261002/`. They are local preparation artifacts. `manifest.json` hashes source and retained evidence; shared dirty-tree provenance is not atomic and upload eligibility is false.

Meta MCP authentication is confirmed with read access. No provider write, deployment, real transaction or message occurred. Hosted acceptance and the release gates in the source report remain outstanding.
