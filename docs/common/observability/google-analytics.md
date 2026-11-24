# Google Analytics and action events

Updated 24 November 2026. This describes the source implementation. A local build does not deploy these changes or prove production ingestion.

## Platform delivery

| Target | Delivery | Collection boundary |
| --- | --- | --- |
| Jest | Google Analytics web stream `G-7CWWGNE52Q`, plus existing Jest `captureEvent` | GA requires player opt-in in Settings and an active production session. Jest's own analytics remain separate. |
| Facebook | Google Analytics web stream `G-1YZP6C2H4V`, plus existing `FBInstant.logEvent` | GA requires player opt-in in Settings, authenticated startup and the existing audience gate. Meta's own analytics remain separate. |
| Android / Google Play | Native Firebase Analytics for registered Android app `1:329028367192:android:4c0af717dd9c0db1b7eb2d` | Disabled by default. The Account screen and offline menu expose the same device preference. Emulator configurations do not connect the sink. |
| Reddit | No Google Analytics or external browser analytics | Browser traffic remains under same-origin `/api/*`. There is no approved custom analytics delivery contract in the current adapter. Shared events do not create network traffic without a destination. |
| YouTube Playables | YouTube's portal reporting and required SDK lifecycle signals | No external analytics calls or analytics SDK. |
| GameSnacks | Required GameSnacks lifecycle signals and platform reporting | No additional analytics SDK or custom-event API is assumed. |
| Netflix, Yahoo and neutral handoffs | No analytics destination | Candidate artifacts remain self-contained. Approved partner contracts are required before adding collection. |

The GA IDs above were read from the existing Firebase registrations. They are public configuration, not secrets. Each web target loads its own `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID`. Android initializes the native default Firebase app from its existing Android registration and checks compatibility with the notification bridge. Gradle generates the native Firebase string resources, including `google_app_id`, from the same selected public hosted config as Metro. These resources are required by the Android measurement SDK; manual Firebase options alone do not configure it. It does not import Firebase browser analytics.

## Consent and payloads

Web consent is affirmative, off by default and stored separately for each target. Withdrawal disconnects the external sink, discards initialization events, disables the Google tag, cancels pending initialization and removes GA cookies. Cross-tab storage changes apply the same withdrawal. Local development and trusted browser fixtures do not load the Google tag. The current screen is sent when a consented destination connects; actions before opt-in are discarded.

Android stores its choice in app-private native preferences. The JavaScript sink and native SDK both check collection permission. Revocation closes JavaScript delivery immediately. Analytics consent is independent of Google account linking and notification permission.

Both transports deny advertising storage, ad user data and personalization. Boolean custom parameters become `1` or `0` in both GA transports. Web config also disables Google signals and advertising personalization. Android removes advertising ID and AdServices permissions and disables automatic screen reporting. Google Analytics still processes its own app/browser instance identifiers and transport metadata when collection is enabled. Application payload filtering is not a claim that the SDK sends no device metadata.

Shared event names and parameter names are bounded to 40 characters, strings to 100 characters, event/item parameters to 25 and item arrays to 10 entries. Non-finite numbers and sensitive key names are discarded. Events must never contain submitted text, canonical answers, usernames, avatars, account IDs, purchase tokens, referral tokens or raw errors. Web event page locations contain only the origin and `/`, with an empty referrer and a fixed title. Major actions use semantic event names; button telemetry uses stable identifiers where available.

## Event catalogue

| Area | Events | Meaning |
| --- | --- | --- |
| Navigation | `screen_view`, `button_press`, `game_mode_selected`, `modal_opened`, `multiplayer_opened`, `multiplayer_closed` | Views and deliberate navigation. Native also records online/offline selection and app lifecycle. |
| Onboarding | `tutorial_begin`, `tutorial_step_viewed`, `tutorial_step_completed`, `tutorial_sequence_completed`, `tutorial_complete`, `welcome_viewed` | Visible guidance and explicit progression through it. |
| Gameplay | `level_start`, `guess_submitted`, `hint_used`, `continue_used`, `riddle_skipped`, `level_end` | Loaded puzzles and accepted action results, with mode, correctness and attempt counts where available. Daily and Classic use `game_mode`. |
| Progression | `earn_virtual_currency`, `spend_virtual_currency`, `level_up`, `unlock_achievement` | Confirmed game rewards, spending and progression. Hint badges do not award coins. |
| Live multiplayer | `live_race_joined`, `live_race_phase_changed`, `live_race_started`, `live_race_completed`, `live_race_*_confirmed`, `live_race_rematch_created` | Accepted transport results and phase changes. Ticket and request IDs remain local for deduplication. |
| Multiplayer social | `live_race_inbox_viewed`, `live_race_history_viewed`, `live_race_invitation_sent`, `live_race_share_requested`, `live_race_share_result`, `live_race_audience_requested`, `live_race_audience_result`, `live_race_opponent_blocked`, `live_race_opponent_reported` | Invitation, sharing, history and safety actions, without rival identifiers or report text. |
| Commerce | `shop_item_selected`, `begin_checkout`, `checkout_result`, `purchase`, provider checkout/cancellation/restore events, `subscription_cancellation_requested`, `subscription_cancellation_result` | Checkout intent and server-confirmed outcomes. Web purchases use receipt fingerprints or opaque provider receipt IDs. Missing receipt identity produces `purchase_confirmed` without revenue; restored subscriptions do not produce a purchase event. A re-signed subscription envelope is not guaranteed to retain the same fingerprint. Android uses checkout outcome events alongside SDK-managed Play purchase reporting to avoid duplicate manual revenue. |
| Accounts | Profile update, leaderboard, account connection/deletion and `identity_action_*` events | Intent and confirmed outcomes, with field/action names only. No account contents. |
| Sharing and referrals | `share_requested`, `share_result`, provider referral acceptance/share events | Player requests and available provider outcomes. Opening a share sheet does not prove delivery or conversion. |
| Notifications and settings | Notification preference request/result events, `setting_changed`, `analytics_consent_changed` | Explicit preference changes. Turning off GA is not sent through the revoked GA destination. |
| Facebook ads | Provider ad request/completion/cancellation/failure events | Facebook-only rewarded and interstitial flows. Other targets do not gain ads. |
| Failures | `client_error`, `action_failed`, native game/identity failure events | Bounded classifications only. Game operations do not await successful analytics delivery. |

Shared provider events carry `platform`, `screen_class` and `schema_version: 1`. Provider-specific capabilities retain their existing funnel event names. Request, completion and paid-action receipts suppress repeated successful deliveries inside the active owner. GA purchase transaction identifiers support deduplication across receipt recovery.

## Operations

1. Build the selected target. Web values are compiled into its artifact. Android requires its normal public production hosted config and registered Android Firebase app.
2. In the linked GA property, review the web streams' enhanced measurement settings. Keep automatic form, outbound link and search-term collection disabled for this game. Verify retention, access and linked products in the actual property; source config does not establish these settings.
3. Register the dimensions needed for reports, such as `platform`, `schema_version`, `game_mode`, `play_surface`, `action`, `phase`, `status`, `product_id` and `source`. Do not register player or receipt identifiers as dimensions. Use standard GA fields for levels, achievements, currency and purchase items.
4. After an explicitly requested release, check consented gameplay in Realtime or DebugView and inspect denial/withdrawal separately. Native debug builds permanently deactivate collection; verify ingestion with a production-config release build when a runtime check is requested. Source review and artifact audits cannot prove Google received events. Browser/device tests are run only when requested.

The web CSP permits the Google tag script and HTTPS Analytics ingestion. It does not insert an eager tag in an entry document. Restricted-target artifact and dependency guards remain in force. Uploads, publication, review submission and deployments still require their own explicit authorization.

Official contracts: [Google tag commands](https://developers.google.com/tag-platform/gtagjs/reference), [Google tag privacy controls](https://developers.google.com/tag-platform/security/guides/privacy), [Firebase Android collection controls](https://firebase.google.com/docs/analytics/android/configure-data-collection), [YouTube external-call restriction](https://developers.google.com/youtube/gaming/playables/support/certification_faq).

## Verification on 24 November 2026

All seven production web build commands passed, including their target artifact audits. Jest retained its existing 0.55 MiB startup budget. Shared and Android TypeScript checks, the 16-locale audit, target-boundary audit, direct security configuration audit and whitespace checks passed. The restricted web artifacts remain isolated and analytics-free.

Android debug assembly, release resource/manifest generation, a production Metro/Hermes bundle and `bundleRelease` passed. The release AAB is 48,436,226 bytes with SHA-256 `051183c27a743fa4f0e21394510572e4f0df3cc750fce64af58d46d4f8c48dd9`. Its compiled resources include the registered native app ID. Merged debug metadata permanently deactivates collection; release metadata leaves collection disabled by default. Advertising ID and AdServices permissions are absent.

No game, browser or device test harness was run, and no artifact was uploaded or deployed. An attempted `pnpm check:security` invoked its bundled braces regression tests unintentionally and stopped on an existing assertion expecting `patches/braces@3.0.3.patch` instead of the configured `config/security-patches/braces@3.0.3.patch`. That unrelated assertion was left unchanged; the direct analytics/security configuration audit passed. Live GA ingestion and actual property settings remain unverified.

The requested follow-up on 24 November 2026 fixed the stale assertion by reading the patch path from the workspace configuration. The related image-size guard now checks both patch directories. The full `pnpm check:security` command passes, including the installed dependency probes and configuration/CI audits. No game artifacts needed rebuilding for this scripts-only correction.
