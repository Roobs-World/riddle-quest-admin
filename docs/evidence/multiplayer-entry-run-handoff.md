# Invitation to confirmed run handoff

One baseline regression recovered a completed accepted challenge, selected another recording explicitly from Activity, started its run, and retried an interrupted hint. The valid resume was rejected because the earlier private invitation still retained its previous attempt ID.

After a valid start, resume or readiness run is adopted, invitation/preview facts now end and selected challenge identity comes from that confirmed run. Entry facts still validate the initial cold recovery before adoption. Subsequent responses remain constrained by the privately confirmed run contract, without inheriting an earlier recording's pointer or preview. No visible copy or locale keys change.

The complete client suite passes 1,746 tests across 207 suites, with 102 tests and 13 suites skipped. Six injected-browser cases exercise completed recovery, Activity navigation, explicit new recording, interrupted hint and the actual rendered Retry button at desktop/mobile widths. Valid recovery succeeds; different run IDs and changed opponent target times remain rejected. Cosmetic display-name changes are permitted by the existing confirmed-run contract and were not tightened. Fifty-four retained cases pass across existing/private entry recovery, category/provider start selection and startup recovery.

The initial browser hint stub used the wrong message name and was corrected after its wait timeout. The initial negative control changed cosmetic metadata; it now changes the immutable recorded target. Those failed harness logs remain retained alongside the final passing run.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and file sizes pass; global concurrent documentation and hosted E2E size failures remain. The manifest retains preceding gates and adds the handoff, for 77 checks. Source, log and artifact hashes are held in `artifacts/race-entry-run-handoff/verification-held.json`.

The 334 captured backend source/config files remain unchanged from the preceding integrated race coverage run. This client-only batch repeats no backend tests and performs no hosted draft update, Jest publication or Firebase deployment. Dashboard completion and the broader multiplayer audit remain pending.
