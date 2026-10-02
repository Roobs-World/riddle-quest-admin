# Exact start origin context

Four baseline failures showed a creator or fallback start accepting an unrequested challenge ID, and creator/counter starts accepting an unrelated rivalry ID. A correct explicitly requested counter-recording already passed. Backend start records retain exactly the original input challenge/rivalry IDs, while publication uses a separate published challenge field.

Start validation now compares both optional origin identifiers exactly against the private command, including absence. Role and category validation remain in place. No visible text or locale keys change.

The complete client suite passes 1,751 tests across 208 suites, with 102 tests and 13 suites skipped. Fourteen injected-browser cases exercise creator, counter and automatic provider fallback starts at desktop/mobile widths. Four invalid origin contexts show the existing translated response error and issue no readiness; valid creator/counter/fallback controls issue readiness once. Forty-two retained cases pass across invitation-to-run handoff, direct/provider start selection, category authority and matchmaking removal.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and size checks pass; global concurrent documentation and hosted E2E size failures remain. The manifest preserves previous checks and adds origin context, for 78 checks. Source, artifact and log hashes are held in `artifacts/race-start-origin-context/verification-held.json`.

The 334 captured backend source/config files remain unchanged from the preceding integrated race coverage run. This client-only batch repeats no backend tests and performs no hosted draft update, Jest publication or Firebase deployment. Dashboard completion remains pending global source gates, and the broader multiplayer reliability audit continues.
