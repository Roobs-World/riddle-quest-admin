# Original artifact browser baseline

Exact snapshot: `artifacts/jest-instructions-modal-2026-10-22/jest-artifact`.
All 419 files / 4,717,648 bytes match the copied manifest before and after verification. Manifest SHA-256: `08c4ec32eedd71896eb9964b8bf1ba324b4aa460b4950bfd3d39c3cb7024be03`.

- Retained compiled-artifact checks: **8 suites / 77 tests passed**, no failures or skips, 317.738 seconds. See `retained-browser-results.json` and `retained-browser.log`.
- Navigation enumeration: **3 graph entries / 337 routes passed**, no route problems or unvisited queued branches, 1,343.838 seconds. Daily: 89 routes / 21 screens; Classic: 81 / 20; multiplayer: 167 / 36. See `route-matrix.json`, `route-progress.jsonl` and `route-sweep-results.json`.
- The walker is bounded to depths 3 / 3 / 5, with a 400-route maximum per entry. It uses actual controls in fresh browser contexts; it does not enumerate every possible answer or storage state. Gameplay, authentication and reload flows are covered by the separate retained suites.
- The instruction regression loops over all 16 locales at each of three viewports (402×682, 320×568, 390×844), within its three reported Jest cases.

These are original-build baseline results. A separate immediate-reload probe found visible `PIA` restoring as `PI`. Two added retained regressions reproduce this on the original artifact; evidence is in `../mobile/immediate-reload-retained-red.log`. The fix and corrected-artifact retained run must be reported separately.

All provider behavior in these local artifact suites is mocked. No real charges, SMS, terms acceptance or account deletion occurred. Real multiplayer authority and emulator evidence are reported independently by the multiplayer owner.

Screenshots copied from the retained run are in `retained-screenshots/`. Useful paths include `daily-skip-warning/warning-390.png`, `coin-economy/shop-390.png`, `jest-feedback-victory.png` and `jest-feedback-profile.png`. Existing shared screenshot paths were restored; `retained-output-restoration.json` records all 10 restorations. Whole directories were preserved, so `retained-screenshot-inventory.json` also contains prior identical images and is not a count of newly generated screenshots.
