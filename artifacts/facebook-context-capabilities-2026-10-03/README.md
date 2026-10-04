# Independent Facebook context capabilities

See [the evidence report](../../docs/evidence/facebook-context-capabilities-2026-10-03.md) for behavior, verification and review limits.

`baseline.log` retains four reproduced failures and 19 passing existing cases. `focused.log` is the passing 42-case adapter/context/policy run. `facebook-chooser-only-browser.log` and `facebook-full-sdk-browser.log` use fresh independently built Facebook artifacts and explicit runtime SDK inventory assertions. `reddit-browser.log` and `jest-browser.log` use the owned cache builds; the Jest run selects six of 74 cases.

`diagnostic/build-targets.cjs` builds and audits all six targets into `/home/craig-beswetherick/.cache/riddle-quest-review/facebook-context-capabilities-20261003/`. The manifest retains source/output/evidence hashes without claiming an atomic snapshot or upload eligibility. No credentials, provider settings, deployments or player messages are included.

The [subsequent capture check](../../docs/evidence/facebook-context-capture-check-2026-10-03.md) withdraws the earlier incomplete-paint inference: original and repaint full-page PNGs are byte-identical and their saved pixels contain the expected board. Preview discrepancies did not establish a browser defect. Repaint/frame-wait instrumentation is removed; the retained `*.png.json` files are historical diagnostic geometry. Explicit owned `FACEBOOK_CONTEXT_SCREENSHOT_PATH` capture paths remain. Hosted rendering acceptance remains open independently.
