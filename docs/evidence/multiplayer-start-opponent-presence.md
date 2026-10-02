# Start opponent presence

Two baseline regressions accepted an opponent on a creator start and omitted the opponent on a fallback challenger start. Direct challenges already rejected missing opponents; valid creator and fallback controls already passed. Backend creator starts have no opponent, while direct/fallback starts provide recorded competitive facts.

Start validation now requires opponent presence to match the private selected origin before adoption or readiness. Creator recordings cannot acquire a ghost deadline, and fallback matches cannot begin without the target needed for competitive completion. The check applies only to start responses; optional omitted-opponent resume compatibility remains intact.

The complete client suite passes 1,756 tests across 209 suites, with 102 tests and 13 suites skipped. Eight injected-browser cases cover invalid and valid creator/fallback starts at desktop/mobile widths. Forty-six retained cases pass across origin context, invitation-to-run handoff, existing opponent recovery including omitted optional views, provider acceptance and matchmaking removal.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and file sizes pass; concurrent global documentation and hosted E2E size failures remain. The manifest retains preceding checks and adds opponent presence, for 79 checks. Source, log and artifact hashes are held in `artifacts/race-start-opponent-presence/verification-held.json`.

The 334 captured backend source/config files remain unchanged from the preceding integrated race coverage run. No backend tests are repeated for this client-only check. No visible copy changes, hosted draft updates, Jest publication or Firebase deployment occur. Dashboard completion and the wider multiplayer audit remain pending.
