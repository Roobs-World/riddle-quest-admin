# Provider match acceptance identity

One baseline regression showed that rewriting the public active challenge ID before default acceptance retargeted a provider match's start command. Four controls already passed: rejection of changed opponent name/target, a valid provider match and an explicit different recording without inheriting the previous preview.

Default challenge selection now consults the privately retained provider preview identity after accepted entry identity, before falling back to presentation-only selection. Provider matches do not have a ready entry response, so this closes their pre-dispatch selection gap. Explicit caller-supplied challenge IDs retain their separate request context.

The full client suite passes 1,743 tests across 205 suites, with 102 tests and 13 suites skipped. Ten injected-browser cases use real provider discovery and rendered Accept Challenge at desktop/mobile widths, with identity poisoning, opponent name/target contradictions and valid/explicit selection controls. Forty retained browser cases pass across start response selection, creator acceptance, waiting invitations and matchmaking removal.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and file sizes pass; global concurrent documentation and hosted E2E size failures remain. The manifest retains preceding checks and adds provider acceptance, for 75 checks. Source, log and artifact hashes are held in `artifacts/race-provider-start-selection/verification-held.json`.

Captured race backend files remain unchanged, while four concurrent solo gameplay files differ from earlier full-backend verification. No fresh full-backend coverage is claimed. This batch changes no visible copy or backend code and performs no hosted draft update, Jest publication or Firebase deployment. The other hosted E2E chat continues overlapping-tab checks uninterrupted. Dashboard completion and the broader multiplayer audit remain pending.
