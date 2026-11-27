# Review Riddle Quest Testing version 12

This handoff is for developer-role testing of Riddle Quest on 27 November 2026. Version 12 is in **Testing**. Review completeness remains unproven. No review submission, Production promotion, or publication is recorded for this candidate.

Use the [API submission checklist](facebook-api-submission-checklist-2026-11-27.md) as the authoritative record of coverage, prerequisites, and acceptance journeys. The [September handoff](facebook-review-draft-2026-09-19.md) is historical and does not describe this candidate's current configuration.

## Select the exact candidate

1. Open Meta's Web Hosting page for Riddle Quest, app `1748953042991569`, with an authorized developer-role account.
2. Confirm that the Testing row is version **12**, bundle `29781063778191740`, with processing complete.
3. Confirm that its SDK selector is **8.0 [Network Enabled Zero Permissions]**.
4. Launch that Testing candidate. Do not select Production as a substitute.

The uploaded source is `8e3b7d2ef942ea387e7370c23ff4f1c1448fa108` on `facebook`. The archive SHA-256 is `a2780de4ed9ac7856f447b4f19d6d7940c0b5067ba87c2436b4fcab524ddac28`, with 2,864,259 bytes, 422 ZIP entries, and 420 runtime files. Meta's downloaded archive matched the recorded hash and byte count. See the [exact version 12 acceptance record](evidence/facebook-testing-version-12-2026-11-27.json).

Production remains version 9, bundle `29168977262783270`. The permission-specific query reports BASIC standard access for developer-role testing, with advanced access absent. This does not establish public availability or product-review approval. See the [role-access follow-up](evidence/facebook-role-access-followup-2026-11-27.json).

## Reproduce the recorded desktop checks

1. Allow Facebook startup and account restoration to finish. The recorded session restored the account's saved Classic loss state without a separate game password.
2. In an eligible Classic loss state, select the rewarded-video action for another attempt. Allow the native video to finish, then close its completed end card.
3. Confirm that the loss dialog closes and answer entry becomes available. In the recorded check, seven editable cells returned and the balance remained 625 coins. The continuation did not award coins.
4. Open **Settings**, then **Privacy Policy**. Confirm that Meta's external-link prompt names `https://roobsworld.com/riddle-quest/privacy`.
5. Select **Go back**. Confirm that Settings controls respond again and that returning to the game leaves **Multiplayer** enabled.
6. Set **Reduced motion** to **On**, select **Quit game**, and relaunch the same Testing candidate. Confirm that the preference remains On. Restore **Off**, quit, and relaunch again. Both saved states persisted in the recorded check. Sound returning to On follows the game's longstanding startup policy.
7. On an eligible host, select **Add to home screen**. Confirm that Meta opens **Save to Your games**, then cancel saving Riddle Quest. The recorded cancellation returned control and created no saved-game shortcut.
8. Complete unique Classic levels until an interstitial opportunity becomes eligible. Keep the result screen open while preparation settles. In the recorded session, immediately leaving the third win retired that opportunity. Holding the sixth win displayed a native interstitial.
9. Select **Close Ad**. Confirm that the victory screen returns and **Next Level** works. The recorded win showed its ordinary 55-coin reward; no ad reward was claimed.
10. Select **Invite a friend**. Confirm that the native dialog identifies Riddle Quest, then select **Close** without choosing a recipient. The recorded cancellation sent no invitation. Closing Profile restored the game with **Multiplayer** enabled.
11. Toggle the host's **Collapse** and **Expand** controls. In the recorded check, Collapse changed the game's `data-facebook-display-mode` from `normal` to `expanded`; Expand restored `normal`. Game controls remained enabled. This verifies the visible mode-change path, not an independent trace of each SDK method.
12. Open **Settings**, then **Terms of Use**. Confirm that Meta's prompt names `https://roobsworld.com/riddle-quest/terms`, then select **Go back**. The recorded cancellation restored enabled Terms and Quit controls.
13. Complete a Classic puzzle and select **Share** on its result. Confirm that the native **Share game** composer contains Riddle Quest result copy. Close the composer without selecting an audience or sending. The recorded cancellation restored **Share** and **Next Level**; advancing returned to gameplay.
14. Open **Race to 10**, then **Play on Facebook**. The recorded session showed **Friends who play** as 0 and an empty **Facebook tournaments** list. **Choose friends** returned **Service temporarily unavailable** and disappeared; **Refresh** did not restore it. No raw SDK error code was captured, so this establishes failure and action retirement only.
15. Use the separate **Play with friends** action. Close its native context chooser without selecting anyone. The recorded cancellation restored enabled **Play with friends** and **Start PvP** controls. Closing the lobby returned to gameplay with **Multiplayer** enabled.

These observations used the real desktop Meta host without SDK replacement or native-result fixtures. They establish the specific startup, save, ad, display, legal-link, and social outcomes recorded above. They do not establish every failure path, entitlement rule, session cap, or mobile-host behavior. Empty counts and listings do not establish matches with other players, tournament joining, or Rooms.

The earlier native follow-up ended with 885 coins after normal gameplay. One subsequent Classic win awarded its ordinary 35 coins, bringing the balance to 920. Sharing and context cancellation added no rewards. See the [initial client review](evidence/facebook-client-review-2026-11-27.md), [first native follow-up](evidence/facebook-native-followup-version-12-2026-11-27.md), and [host and social follow-up](evidence/facebook-host-social-followup-version-12-2026-11-27.md).

The candidate also passed 136 focused tests across nine suites, shared typecheck, the combined local browser journey, and `pnpm preflight:facebook-upload`. The artifact audit found no Jest gaming-platform SDK, native modules, or credential leakage. Jest unit-test tooling is unrelated to the gaming-platform SDK. Local fixture results do not establish native host support.

## Continue the outstanding reviewer journeys

Record each result against version 12, the actual host, and the account's eligibility. Keep unsupported, cancelled, failed, and completed results separate. Use the checklist's full J01–J14 procedures for failure paths and account retirement.

1. Check save failure, interrupted reward delivery, and duplicate-reward prevention. The accepted preference save-and-quit check does not establish these failure paths.
2. Verify follow-page and join-group eligibility and cancellation independently. Successful shortcut creation remains separate from the recorded cancellation.
3. With consenting testers on eligible hosts, complete context creation, matchmaking, and the authorized recipient side of social journeys. Counts are not an online-player directory. The recorded **Choose friends** failure and separate **Play with friends** cancellation do not establish successful context membership or co-play.
4. With consenting testers and an eligible tournament, join from the native list. Confirm that the game opens the matching official board only after validating the fresh native tournament data. Tournament routing and cancellation passed locally; native version 12 acceptance remains open.
5. Check ad failure and cancellation paths, authoritative subscription suppression, durable interstitial removal, cooldowns, and session caps on eligible hosts. One completed rewarded video and one interstitial do not establish these cases.
6. Repeat applicable journeys on a supported native mobile host. Check pause and resume, dialogs, available profile overlays, and optional haptics or session-score actions. A resized desktop browser is not mobile-host evidence.
7. Use separate authorized accounts to check save isolation, retired operations, and account cleanup. Verify the server-owned outcomes separately. No account-deletion or purchase-recovery acceptance is claimed here.

Invitations, chat posts, notification delivery, purchases, and refunds need explicitly scoped test actions and eligible participants. This handoff does not authorize sending or spending.

## Keep conditional features out of acceptance claims

The [dashboard prerequisite record](evidence/facebook-dashboard-api-prerequisites-2026-11-27.md) and the checklist distinguish source wiring from a usable provider integration.

- Commerce is disabled. The seven-product catalog exists, but payout setup, IAP approval, V2 payment callback acceptance, signed purchase verification, refunds, and recovery remain open. Do not describe this candidate as purchase-ready.
- Banners are disabled by default. There is no independent approved banner placement. Enabling the feature requires its own placement and deployment flag; rewarded and interstitial placements do not satisfy that requirement.
- Messenger bot permission is disabled by default. Bot Review is Not Submitted, and the required `pages_messaging` access and use case are unresolved. This permission is separate from the game's notification-manager preference.
- Private tournaments are disabled by default. App allowlisting, player rollout, an eligible Messenger group, and compatible higher-is-better scoring settings remain unverified.
- Rooms needs an eligible live Messenger Rooms match. No accepted native Room join is recorded.
- The Riddle Quest App Page is linked. Group association and player-specific community eligibility remain unverified.
- Profile overlays, haptics, session-score variants, and other optional actions depend on the real host's advertised APIs and callable methods. The recorded desktop host did not expose all of these families.

## Resolve the six API gaps

The [current API inventory](facebook-api-research-2026-11-27.md) and checklist cover 79 documented entry points. These six remain gaps:

- `FBInstant.switchGameAsync` needs a real configured destination and a meaningful Riddle Quest product workflow.
- `player.getASIDAsync` needs an eligible legacy identity and an authoritative migration contract.
- `player.getSignedASIDAsync` needs that migration contract and trusted signed-identity verification.
- `player.getAssociatedAppsASIDAsync` needs a genuine same-game app association and an authoritative account-link contract.
- `player.getSignedAssociatedAppsASIDAsync` needs that association and trusted signed-identity verification.
- `player.createNEZPNotificationContentAsync` needs manager-authored content, a receipt bound to the current generation, a dispatch consumer, and trusted verification or manager approval. A browser-returned content ID alone cannot authorize a campaign.

Cross-Play Management is Not Linked. Do not invent a destination, associated app, identity merge, or notification authority to close a checklist row. Firebase, its configuration, and provider server modules remain preserved under the owner's instruction. Backend readiness remains a separate acceptance requirement.

## Reconcile review prerequisites before submission

Business Verification is Verified and In App Ads is Approved. Those statuses cover only their named requirements. Approved Partner Program, Policy, Quality, In App Purchases, Bot, and App Property are Not Submitted in the recorded dashboard state. Policy and Quality submission controls are disabled.

The permission-specific Zero Permission Access query reports `standard_access: true`, `advanced_access: false`, and tier `BASIC`. Its aggregate privilege still reports `is_live: false`, `is_rejected: true`, `grant_status: REJECTED`, and `access_level: none`. BASIC role-account access and the unresolved public-access status must remain distinct.

The connector reports App Review as UNSUBMITTED while its requirements report a previous review in progress. The new history query returns no submissions and `has_been_previously_reviewed: false`, although the permission query reports `in_current_submission: true`. Preserve these conflicting responses without inferring a pending or approved review. See the [original review state](evidence/facebook-live-review-state-2026-11-27.json) and the [permission-specific follow-up](evidence/facebook-role-access-followup-2026-11-27.json).

[Read-only deployment metadata](evidence/facebook-deployed-authority-2026-11-27.md) confirms 32 selected functions are active on `nodejs22`, with latest-revision traffic and the Riddle Quest Facebook app binding. No function was invoked or Firebase setting changed. This does not establish source-commit correspondence, every shared endpoint, account entitlements, signed receipts, idempotency, callback delivery, or notification dispatch. Full backend acceptance remains open.

The subsequent [deployed source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md) found that all three downloaded representatives differ from the protected baseline. The active configuration source lacks subscription-based ad suppression, and version 12 relies on its returned ad booleans. No live subscriber harm was observed; durable interstitial removal remains present. Treat subscription suppression as an acceptance blocker. The preserved Firebase backend has not been repaired or redeployed.

Before submission, complete the applicable native journeys, verify deployed server behavior without changing the preserved Firebase backend, resolve the missing product and provider prerequisites, and confirm current legal, age, support, and retention disclosures. Production promotion, review submission, and publication each remain separate authorized actions.
