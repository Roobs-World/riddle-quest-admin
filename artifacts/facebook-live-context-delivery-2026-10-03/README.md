# Facebook live context delivery diagnostics

See [the evidence report](../../docs/evidence/facebook-live-context-delivery-2026-10-03.md) for authority, verification and release limits.

`emulator-final.log` is the passing seven-suite, 105-case run. `*-diagnostic.log`, `emulator-baseline.log` and early logs retain intermediate failures separately. Final full units use `functions-units-final.log`, `portal-units-final.log` and `core-units.log`. Provider browser logs use injected Chromium/SDK harnesses; `jest-browser.log` covers six selected cases only.

`diagnostic/build-targets.cjs` builds and audits all six targets into the owned cache `/home/craig-beswetherick/.cache/riddle-quest-review/facebook-live-context-delivery-20261003/`. `diagnostic/compiled-runtime.cjs` checks server module loading under the configured Node 22 runtime without invoking a handler. `manifest.json` retains hashes and explicitly denies atomic source/build equivalence and upload eligibility.

`meta-review-summary.json` retains only sanitized read-only status. No credential, provider assertion, deployment, provider mutation or real player message is included.
