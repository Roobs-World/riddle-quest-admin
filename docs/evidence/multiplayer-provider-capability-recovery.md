# Multiplayer provider capability removal recovery

Removing a tournament adapter while its view was selected left the unsupported tournament panel open. The remaining Play and Activity buttons both had `tabIndex=-1` and neither was selected. A mounted game browser harness reproduced zero keyboard entry points after capability removal; a component-interface test independently reproduced the same failure.

`RaceTo10Game` now navigates from the unavailable tournament screen to the supported Play hub. `RaceHubTabs` gives Play the selected state and keyboard entry point during the parent transition, while leaving Activity and supported tournament selection unchanged. Re-enabling the capability does not restore obsolete cached standings. Provider ownership disposal still prevents old success and failure replies from changing the supported hub or reporting errors. No canonical race mutation or visible translation change is added.

## Evidence

- The initial mounted-game browser run failed with zero reachable tabs (`artifacts/race-provider-capability/before.log`). The isolated component test failed before the fix; the eleven existing component cases passed (`unit-before.log`). All twelve cases pass afterward (`unit-after.log`).
- Eight mounted desktop/mobile browser scenarios remove the adapter with a pending read or a cached board plus refresh, deliver the old success or failure, verify supported hub fallback and Home/End navigation, re-enable the capability, and verify fresh standings without a canonical race mutation or error alert (`after.log` and screenshots).
- This work also corrected the category fixtures in the provider recovery and deadline harnesses to include the schema-required race rules. Both retained harnesses now assert that no visible error alert is present, in addition to their delivery and mutation checks. Earlier missing-rules fixture responses did not invalidate the independently observed lost-write or keyboard-entry failures, but could leave an unrelated presentation error; corrected fixtures prevent that ambiguity.
- The latest completion manifest retains all prior provider delivery, responsive navigation, multiplayer and isolated-build checks, adding the capability-removal browser gate. The generated full-source receipt must cover stable source before automatic dashboard recording. Focused verification while the authorized Jest hosted E2E chat is active does not bypass that gate.

These source changes have not replaced the pinned active Jest preview being tested by the other chat. Jest publication remains on hold. This client-only change requires no Firebase Functions deployment. The broader reliability audit remains active.
