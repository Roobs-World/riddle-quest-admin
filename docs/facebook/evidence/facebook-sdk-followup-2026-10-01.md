# Facebook SDK follow-up — 1 October 2026

The Facebook adapter is prepared for further local testing with Meta's v8 SDK.
No backend deployment, Meta build upload, notification activation, review submission,
or public promotion was performed. Existing working-tree multiplayer changes were
preserved. This follows and supersedes the staged notification/placement findings in
[the earlier testing preparation](facebook-testing-readiness-2026-10-01.md).

## MCP installation outcome

Registered the remote `facebook` MCP server in the local Codex configuration using
`https://mcp.facebook.com/ads`. Meta rejected the automatic OAuth client registration
with HTTP 400, `invalid_client_metadata`: “Dynamic registration is not available for
this client.” Registration is present and enabled, but the connection is **not
authenticated or usable**. No access token, app secret, or private player data was
submitted to this MCP connection. Other MCP registrations were preserved.

The endpoint's advertised scopes cover Ads, catalog, business, and Pages management.
It does not supply an Instant Games developer-console transport. The live console
inspection below used the owner's existing browser session. An approved OAuth client
or a different specified Instant Games MCP is needed to finish connecting an MCP;
this registration is not evidence that a game-management connector is installed.

## Changes and provider boundaries

- Added a Facebook notification capability using `player.canSubscribeBotAsync`,
  `player.isSubscribedBotAsync`, and `player.subscribeBotAsync`. Composition requires
  authenticated server configuration, the explicit 13+ configuration, and all three
  APIs advertised by the Meta host. Existing subscribers do not get another dialog.
  Consent is confirmed after subscription; cancellation, ineligibility, and failures
  remain distinct. Concurrent requests share one operation.
- The existing authoritative win/cooldown lease coordinator now receives this real
  provider capability. Its acceptance still comes from the server. Individual
  scheduling/cancellation reports unavailable; no Jest scheduling implementation
  is called or substituted.
- Added an SDK-instance dialog guard shared by bot subscription and Facebook ads.
  Rewarded and interstitial requests cannot overlap each other or the notification
  prompt. A format requires its own advertised SDK API, not merely another ad API.
- Configured the two existing, verified public Audience Network placement IDs:
  `1748953042991569_1765481644672042` (ResultsInterstitial) and
  `1748953042991569_1765482768005263` (ContinueRewarded). Interstitial policy,
  authenticated kill switches, and ad-free suppression remain enforced.
- Corrected staged purchase parsing for numeric positive safe Unix-second purchase
  times. Legacy decimal strings remain accepted. Catalog images may be absent/null/
  empty because Meta no longer supports IAP catalog images; malformed legacy image
  fields still fail validation. Exact catalog IDs/prices and grant-before-consume
  recovery remain enforced. Commerce is still unreachable from the release adapter.
- Prepared review-only event-based D1/D3/D7 reminder copy in all 16 locales, each
  within the console's 84-character field limit. These JSON drafts are a review
  document, not an invented Meta import format; nothing was saved or activated.
- Jest browser fixtures now consistently honor `PORTAL_JEST_BUILD_DIR`, allowing
  verification against an immutable copy while other work rebuilds the shared
  output directory. The safety pending assertion waits for React's committed UI
  while the server response is deliberately held. No Jest production adapter changed
  in this follow-up.

The API contract was checked against the actual distributed
[Meta v8 SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js), inspected SHA-256
`b00592e89ece9357675cb130d802f3908172dc2f27e1b54a702e18eff0f2ac23`, and the
[Meta wrapper reference](https://facebook.github.io/meta-instant-games-unity-plugin/documentation/API_REFERENCE.html).
The deployed Facebook SDK remains Meta-hosted. Ads remain exclusive to Facebook;
Jest retains its own SDK, purchases, notification implementation, and purchase tour.

## Live console findings

Inspected Meta app `1748953042991569` and Audience Network property
`957348766757902` on 1 October. These are observed console states, not approval claims.

| Area | Observed state | Remaining work |
| --- | --- | --- |
| Publication | App unpublished; ZeroPermissionAccess ready for testing | Hosted role-account acceptance and final release approvals |
| IAP catalog | All seven expected products and USD base prices present; test-payment mode already enabled | Valid payment account required; verified purchase/refund contract and public authoritative verifier |
| Audience Network | Existing rewarded/interstitial placements, both Idle; property requesting ads | Real hosted load/show and availability evidence; rewarded completion authority before offering rewards |
| Notifications | No templates configured; event-based timing after last play available | Review/activate drafts and verify consent, delivery, opt-out and deep links on hosted clients |
| IARC | Incomplete; no certificate | Owner supplies truthful classification and certificate |

No products, payment settings, compliance answers, permissions, or ad spaces were
created or changed in Meta. The notification creation form was inspected and cancelled.
Activating reminders sends messages to players and requires an explicit instruction.
Financial/legal setup and physical-device acceptance cannot be completed from local
injected SDK tests.

Rewarded video playback support does not authorize an economy grant. There is no
rewarded UI/grant flow in this candidate. The server must be able to verify completion
and grant idempotently before offering a reward; browser `showAsync()` alone is
insufficient under the repository's economy requirements. Purchases likewise remain
disabled until signed receipt and raw refund fixtures establish the provider-verifier
contract, alongside Meta payment setup. These gates are not Jest dependencies.

## Verification

Logs are retained in the [validation directory](../../../artifacts/facebook-sdk-followup-2026-10-01/validation/).

| Check | Result |
| --- | --- |
| Portal unit suite | 166 suites / 1,395 tests passed; 95 opt-in tests skipped |
| All target builds | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks passed with artifact isolation audits |
| Facebook injected SDK browser | 1 passed; wrong answer never prompts, authoritative win claims one lease, confirmed bot subscription is accepted before the configured result interstitial loads/shows; lifecycle, save, deletion and context cases retained |
| Jest authentication browser | 62 passed against immutable Jest build |
| Jest gameplay browser | 5 suites / 16 tests passed against immutable Jest build |
| Other browser harnesses | Reddit 1, YouTube 10, Netflix/Yahoo 2 passed |
| Release-script tests | 128 passed |
| Source checks | Portal types, TSDoc, file-size, Facebook secret/profile/commerce boundaries and whitespace passed |

Earlier Jest runs encountered a missing asset during shared build changes, a timing
failure observing safety pending UI, and onboarding/profile timeouts. A focused full
gameplay journey passed against the immutable build. The final full regression run passed all 16 tests; initial failed logs are retained
so the limits of the evidence remain visible. Local results do not prove real Meta
permission, receipt/refund, ad, CSP, or iOS/Android behavior.

## Local candidate and handoff

- [Local test ZIP](../../../artifacts/facebook-sdk-followup-2026-10-01/riddle-quest-facebook-sdk-local-test.zip):
  SHA-256 `395facfd4fc62096e39aa8b66dac67f70cfe8f46d77548b38f5821fb6bf6a60b`,
  2,758,326 bytes, 400 regular files; ZIP integrity and root `index.html` /
  `fbapp-config.json` checked.
- [Manifest](../../../artifacts/facebook-sdk-followup-2026-10-01/manifest.json): dirty
  working-tree local candidate, source HEAD `8dc08e65f3a72f964137e68eff70487eb7bbf700`,
  **uploadEligible: false**. Includes unrelated preexisting multiplayer work.
- [Reminder drafts](../../../artifacts/facebook-sdk-followup-2026-10-01/notification-reminder-drafts.json):
  review-only; not saved to Meta.

Review and commit the intended changes, reconcile existing upload receipts, then use
the clean-source exact-byte process in the [operations runbook](../facebook-instant-games-operations.md).
The current local ZIP has not replaced Testing version 4 or been deployed. Remaining
acceptance includes real signed identity/App Check, host pause/resume, ads, cloud saves,
account deletion across devices, notification delivery, social/context/race behavior,
effective CSP/network evidence, and purchase/refund recovery once the verifier is ready.

Follow-up: [Meta Social Technologies MCP registration](../../common/web-game/evidence/meta-social-technologies-mcp-2026-10-01.md)
adds the separate official `/devtools` endpoint with successful dynamic OAuth
registration and an eight-tool read allowlist. App consent is still pending user
approval; no authenticated tool or app read has been claimed. The earlier Ads
endpoint/authentication finding above remains the historical capture.
