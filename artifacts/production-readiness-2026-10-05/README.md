# Production readiness verification — 5 October 2026

Status: **local verification complete**. All six isolated production builds, their artifact audits, and the E2E components pass after corrections. No provider upload or publication was performed. Upload preflights still require the dirty working tree to be committed, and Netflix/Yahoo remain engineering candidates pending approved partner contracts.

The preserved handoff artifacts are under [release-builds/](release-builds/). [final-artifacts.json](final-artifacts.json) records their sizes, inventories, SHA-256 hashes, source hash, and dirty-tree provenance. All six were built in private `/tmp` directories and copied with byte verification because other local chats were rebuilding the shared canonical `builds/` directories. YouTube, Netflix, and Yahoo include real release content for all 16 locales, at least 180 Classic riddles and 180 Daily schedule entries; none is a fixture.

## Corrections made during this run

- Restored the Core 100% coverage gate by checking the exported lazy grapheme iterator, including NFC normalization and a joined emoji.
- Replaced the two flagged race schema `superRefine` calls with Zod `check`, retaining the validation conditions and error messages. API reference: https://zod.dev/api?id=check.
- Updated the recorded-race deletion fixture to establish the production deletion guard before sweeping identity snapshots.
- Updated stale live context, deletion, and rematch balance expectations to include the authoritative one-time achievement grants. Replays still verify that grants are not duplicated.
- Added catalog session replacement, retired keyboard callback, and legacy empty guess history coverage. Removed an unreachable duplicate keyboard admission condition.
- Backend production coverage now runs unit and real emulator transaction tests together. All existing global and per-file thresholds are retained; CI provisions Java 21 for the emulators.
- Production verification uses the canonical E2E interface, covering all six release artifacts and candidate browser flows without replacing the YouTube release content with a fixture.
- Facebook preparation now validates a retained operator `reconciled-absent` receipt. Malformed absence evidence remains blocked, as does retransmitting the same archived bytes. Historical receipts were preserved.
- Updated stale graphics fixture counts for the current sprite scene (74 owned resources) and replaced the removed point-cloud failure site with partial sphere-allocation failure. Layout and resource checks pass in both React modes.
- YouTube IME admission now separately verifies unowned trailing composition events and a newly owned composition while a save is pending. Both React modes pass.
- Mobile soak now waits for the actual startup puzzle instead of requiring Classic's sentence when startup selects Daily.
- Increased the serial browser CI timeout to 120 minutes: the completed harnesses alone already exceed the previous 30-minute limit. The workspace coverage job provisions Java 21.
- Fixed real touch-target failures: 48/42px CSS keys were scaled down to about 26–28 physical pixels. Solo and race fitting now accounts for a compensated 33px minimum, including short landscapes, translations, resize, and reduced motion. The browser threshold remains 32px.
- Corrected generic ARIA-labelled containers, heading-free sections, and missing shop/achievement/rank headings, preserving their styling and translated copy. Four Arabic locale files were normalized to NFC after the rendered HTML validator identified combining-mark order.
- Automatic YouTube fixture tests now build and serve an isolated temporary directory. Both fixture and release-content suites pass, and a fixture test cannot silently replace the canonical production artifact.

## Verification evidence

| Check | Evidence |
| --- | --- |
| Frozen dependency synchronization; lockfiles unchanged | `install-current.log` |
| Initial security audits and Node 22 compatibility | `production.log` (later stopped at the now-corrected Core coverage gap) |
| Core: 318 tests and 100% coverage | `core-coverage.log`, `coverage-fixed.log` |
| Portal: 2,758 passing unit tests and all coverage gates | `coverage-fixed.log` |
| Backend: 191 suites, 2,405 tests, all coverage gates | `functions-coverage-combined.log` |
| Reddit server: 51 tests | `reddit-server-tests.log` |
| Jest authentication/platform integration: 47 tests | `jest-auth-handoff.log` |
| Final Portal unit coverage: 2,758 tests, all thresholds unchanged and passing | `portal-coverage-handoff.log` |
| Workspace production build, Reddit client/server and Functions build | `build-handoff.log` |
| Six preserved production builds and artifact isolation audits | `snapshot-build-jest.log`, `snapshot-build-facebook.log`, `snapshot-build-reddit.log`, `snapshot-build-youtube.log`, `snapshot-build-netflix.log`, `snapshot-build-yahoo.log` |
| Release scripts: 152 tests | `release-scripts-handoff-final.log` |
| Architecture checks: 37 tests | `architecture-handoff-final.log` |
| Type checking and required declaration documentation | `types-fixture-guard-final.log`, `tsdoc-fixture-guard-final.log` |
| W3C HTML: zero findings across seven entry documents | `w3c-last.log` |
| Gameplay/navigation browser suites: 27 tests | `jest-gameplay-handoff.log` |
| Final Jest hosted browser journey on preserved artifact | `snapshot-browser-jest.log` |
| Final Facebook injected platform flow and rendered HTML/accessibility | `snapshot-browser-facebook.log` (explicit isolated 13+ capability fixture) |
| Final Reddit preserved artifact flow, same-origin API and checkout | `snapshot-browser-reddit.log` |
| Final YouTube preserved artifact browser and achievement suites: 13 tests | `snapshot-browser-youtube.log` |
| Final Netflix/Yahoo preserved artifact local gameplay and currency: 2 tests | `snapshot-browser-standalone.log` |
| Race keyboard admission: 648 checks per React mode | `race-keyboard-browser.log` |
| Race Tab ordering: 108 checks per React mode | `race-tab-browser.log` |
| Connectivity: 402 checks per React mode; offline input boundary: 1,719 checks per React mode | `jest-browser.log` |
| Facebook receipt regression: 8 tests | `facebook-state-regressions.log` |
| Jest dry-run packaging and Facebook local draft preparation | `jest-preflight-handoff.log`, `facebook-preflight-handoff.log` |
| Current six build artifact inventories and SHA-256 validation | `final-artifacts.json`, `inventories/` |
| Short viewport: 900 checks per React mode, all 16 locales | `short-viewport-fixed.log` |
| Resize/reduced motion: 3,840 checks per React mode | `viewport-fit-reflow-fixed.log` |
| First full ten-minute mobile soak | `mobile-soak-complete.log` |
| Final full ten-minute mobile soak: 603 seconds, no runtime errors | `mobile-soak-release-final.log` |
| Current platform flows and rendered standards (Facebook, Reddit, YouTube, Netflix, Yahoo) | `facebook-e2e-final.log`, `reddit-e2e-final.log`, `youtube-e2e-final.log`, `standalone-e2e-final.log` |
| YouTube fixture isolation and release-content regression: 13 tests each | `youtube-fixture-isolation-final.log`, `youtube-release-isolation-final.log` |
| Recovery matrix: all 16 selected scripts exit successfully | `browser-retry/results.json`; source-stable follow-ups below |
| Provider save recovery: 344 checks per React mode | `provider-save-handoff.log` |
| Guidance storage recovery and cold blocked Reddit storage | `guidance-storage-handoff.log` |
| Offline keyboard boundary rerun: 1,719 checks per React mode | `offline-keyboard-handoff.log` |

## Execution notes

All 96 independent browser scripts are covered by the original run and corrective reruns. The initial 92-script matrix completed with five failures (graphics layout/resources, IME admission, short viewport, resize); all were corrected and rerun. Four earlier passing scripts were replayed in recovery verification. The two viewport suites retain their full development/production matrices. The 16-script recovery matrix has successful script exits, but its aggregate records changed source hashes from concurrent edits; affected checks have additional follow-ups. Original failures and interrupted wrappers remain in the evidence directory.

The first canonical E2E run exposed 21 stale reward assertions across three suites (60 other emulator suites passed). Their corrections pass in the combined coverage run. Its earlier log is retained as `e2e-fixed.log`.

Reddit's first platform browser attempt encountered a blank reload while another local process rebuilt the shared output. The complete unchanged flow passed against an isolated copy of the artifact in `/tmp/riddle-production-readiness-2026-10-05/reddit`.

The long Jest browser chain was split after its passing gameplay, connectivity, and offline boundary checks. The remaining independent scripts run in three workers, each retaining an exit code and before/after source hashes. An interrupted chain is not a full E2E pass.

Concurrent local work moved canonical output directories to `builds/`, added rendered HTML/accessibility checks, and corrected a tooltip from `h3` to `h2`. Build/test attempts that straddled those edits are retained; affected verification was repeated against the current source. The final platform flows passed the new rendered HTML/accessibility checks. Production declarations in the new standards helper carry the required documentation.

The final Jest, Reddit, YouTube, Netflix, and Yahoo browser flows serve the preserved artifacts. Facebook's existing harness intentionally builds its own isolated 13+ artifact to exercise gated capabilities; its final flow and the separately preserved production artifact audit both pass. Runtime source SHA-256 was unchanged between the private builds and the final artifact verification. Local tools report Node 24, while the backend requires Node 22; the separate compatibility checks passed and CI retains Node 22.

Final verification is executed in logged components rather than repeating the entire serial aggregate (the first 92-script matrix alone totals 76 minutes). No failed/interrupted aggregate command is represented as a successful aggregate run. Reruns retain the original failure evidence.

Both upload preflights report the dirty working tree and block uploading until the verified source is committed. Netflix/Yahoo remain provider-neutral engineering candidates; partner submission contracts are still external requirements.
