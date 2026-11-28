# Facebook dashboard follow-up — 28 November 2026

The finite read-only check reached Meta's authenticated hosting dashboard. Its fresh rows confirm **Testing 23** and **Production 9**; the signed-in Firefox game route separately displays an unsupported-browser message. The [structured record](facebook-dashboard-followup-2026-11-28.json) preserves the bounded observations and seven private receipt hashes.

At **08:26:22.817 UTC**, the known Riddle Quest game URL showed no login prompt and did show the unsupported-game message. This establishes that route's result in this Firefox session, not an exact loaded game version or a failure on every desktop browser.

At **08:27:19.956**, the hosting dashboard showed:

| Row | Version | Bundle | Archive filename digest |
|---|---:|---|---|
| Testing | 23 | `40683991141214635` | `8144475232cbb8133e2f61a8954ed6e7bd19dec11e8635d1c1862c22b1e7d163` |
| Production | 9 | `29168977262783270` | `11b614b7c7d483041b689c5ba9750468da37a3a6a5824b7e85f4369eca99dcca` |

Both rows displayed **Quality Review Unknown**. The SDK **8.0 Network Enabled Zero Permissions** label was visible. A later bounded read at **08:31:15.628** confirmed the checked control beside **“Debug Mode / Enable debug mode in your game”**. Debug Mode was enabled; no setting was changed.

At **08:32:52.006**, the Instant Game product review page showed **Business Verification: Verified** and **In App Ads: Approved**. Approved Partner Program, Policy, Quality, In App Purchases, Bot and App Property remained **Not Submitted**. At **08:33:38.738**, both **Create submission** and **Submit Review** exposed `aria-disabled="true"`; neither was clicked. These product-specific observations do not reconcile the distinct, contradictory [general App Review connector responses](facebook-prerequisite-recheck-2026-11-28.json).

Cross-Play Management at **08:34:01.781** remained **Not Linked**. The page requires a same-game attestation when linking distinct app IDs and says a shared App ID needs no link. Its explanatory reference to the cross-play eligibility capability does not establish that capability's state. No link action or association change occurred, and no genuine off-platform app ID was established.

Details at **08:35:01.365** showed **Portrait**, App Page **Riddle Quest** and connection experience **Zero permissions**. Bound toggles showed **Flexible Aspect Ratio off** and the **NEZP override for Testers/test users on**. No Group-association or private-tournament-scoring setting was observed on that page; this is not evidence of global absence. Save, Confirm and Delete were untouched. The tester override does not establish public migration or approval.

The hosting rows and SDK labels do not establish a new archive download/hash, separate processing-status read or product approval. The [immutable version 23 release evidence](facebook-testing-version-23-2026-11-28.json) retains its original timestamps and limits; the later Production observation does not rewrite earlier statements that Production had not been freshly read.

The authenticated Firefox session was left on Details. Separate Chrome sign-in remained pending; no Chrome game acceptance is recorded here. No provider setting, Testing/Production assignment, source or Firebase/provider-server configuration changed. No tests, builds, uploads, review submissions or publication occurred.
