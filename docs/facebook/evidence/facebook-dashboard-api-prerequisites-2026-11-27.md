# Facebook dashboard API prerequisites — 27 November 2026

Read-only inspection of the authenticated Meta App Dashboard for Riddle Quest (`1748953042991569`). No settings, submissions, permissions or hosted versions were changed.

## Hosted artifact

The following paragraph preserves the initial dashboard observation, when version 6 was Testing. The later [version 12 acceptance record](facebook-testing-version-12-2026-11-27.json) supersedes that Testing assignment and binds the current candidate to its exact archive. Production remains version 9. This note does not recast the initial observation as a fresh dashboard read.

The [Web hosting page](https://developers.facebook.com/apps/1748953042991569/use_cases/customize/hosting/?use_case_enum=INSTANT_GAMES&selected_tab=hosting&product_route=instant-games) lists version **9**, bundle **29168977262783270**, as **Production**. Its filename is `artifact-11b614b7c7d483041b689c5ba9750468da37a3a6a5824b7e85f4369eca99dcca.zip`. Version 6 remains Testing; versions 1–5 and 7–8 are Standby. The SDK selector is **8.0 [Network Enabled Zero Permissions]**, with Debug Mode enabled.

The version 9 filename agrees with the earlier upload record. It predates the current source expansion; this observation does not establish that any new integration has reached the hosted game. Quality Review for that bundle displays N/A / Unknown.

## Instant Game reviews

The [Instant Games Review page](https://developers.facebook.com/apps/1748953042991569/use_cases/customize/review/?use_case_enum=INSTANT_GAMES&selected_tab=review&product_route=instant-games) displays:

| Review | Observed state |
| --- | --- |
| Business Verification | Verified |
| Approved Partner Program | Not Submitted |
| Policy | Not Submitted |
| Quality | Not Submitted |
| In App Purchases | Not Submitted |
| In App Ads | Approved |
| Bot | Not Submitted |
| App Property | Not Submitted |

The Policy + Quality tab offers no existing submission and disables both Create submission and Submit Review. Its partner-program prerequisite remains incomplete.

Opening the Bot Review information panel states that Messenger Game Bot requires `pages_messaging` through App Review and the `gamebot with Messenger` use-case addition. The current notification manager's A2U integration does not establish this Messenger approval. Do not request bot permissions or subscribe a player merely to exercise an SDK method.

## Cross-play

The [Cross-Play Management page](https://developers.facebook.com/apps/1748953042991569/use_cases/customize/cross-play-management/?use_case_enum=INSTANT_GAMES&selected_tab=cross-play-management&product_route=instant-games) displays **Not Linked**. Linking requires a real off-platform version of the same game and an attestation. No association was created; associated-app identity remains a prerequisite-dependent integration.

## Connector discrepancy

The [read-only connector response](facebook-live-review-state-2026-11-27.json) describes a general App Review record as UNSUBMITTED, yet its requirements response says a previous review is in progress. Those fields must not be used to infer that Instant Game Policy/Quality review is pending: the product-specific dashboard explicitly shows Not Submitted. Preserve both observations until Meta resolves their differing states.

The later [permission-specific follow-up](facebook-role-access-followup-2026-11-27.json) queried `Instant Games Zero Permission Access` for app `1748953042991569`. It reports `standard_access: true`, `advanced_access: false`, and tier `BASIC`. This grants BASIC developer-role access; advanced public access is absent. The aggregate privilege still reports `is_live: false`, `is_rejected: true`, `grant_status: REJECTED`, and `access_level: none`. These fields do not establish product-review approval.

The permission is optional for `INSTANT_GAMES`, with no required use cases, listed requirements, prerequisite permissions, or eligible actions. Those empty permission-specific lists do not clear the separate product-review prerequisites. The permission query also reports `in_current_submission: true`, but the history query returns `submissions: []` and `has_been_previously_reviewed: false`. Preserve that discrepancy alongside the original status and requirements responses; do not infer that a review is pending or approved.

## Still required

- Complete and verify the applicable partner/review prerequisites before claiming public availability.
- Bind a fresh immutable artifact to the final source revision and verify its exact hosted version after an authorized upload.
- Confirm payment approval, payout and signed webhook readiness before enabling commerce.
- Supply an approved banner placement before enabling its separate deployment flag.
- Verify private-tournament allowlisting, score settings and rollout before enabling private tournament creation.
- Observe supported host behavior for every included integration; source declarations and a successful local build cannot establish native acceptance.

## Advertising and game-details follow-up

Read-only inspection of Monetisation Manager on 27 November found **two ad spaces and two placements** for RiddleQuest, property `957348766757902`: Results contains the interstitial `1748953042991569_1765481644672042`; Continue contains rewarded video `1748953042991569_1765482768005263`. Both placement rows displayed **Idle**, while the game platform displayed **Requesting ads**. No banner placement exists in those two spaces. The candidate's banner feature must remain disabled until a separate approved banner placement is created and configured.

Game Details displayed a linked **Riddle Quest** App Page, portrait orientation, Flexible Aspect Ratio off, Zero Permissions selected, and the NEZP tester override enabled. It exposed no private-tournament scoring controls. This inspection therefore does not establish private-tournament allowlisting or compatible dashboard scoring. No setting, placement or permission was changed.
