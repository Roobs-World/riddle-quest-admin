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

### Property and stream inventory

The owner's Firebase console screenshot supplied on 24 November 2026 identifies property `riddle-quest-ec2b2`, property ID `545194073`, with these streams:

| Platform | Numeric stream ID | Collection configuration |
| --- | --- | --- |
| Android | `16378518116` | Native Firebase app `1:329028367192:android:4c0af717dd9c0db1b7eb2d` |
| Facebook | `15543205796` | Web measurement ID `G-1YZP6C2H4V` |
| Jest | `15241797219` | Web measurement ID `G-7CWWGNE52Q` |
| Yahoo | `15809641012` | Registered measurement ID `G-FCX82P3TWT`; candidate collection remains disabled |

Numeric property and stream IDs identify reporting resources. They do not replace web measurement IDs or the Android Firebase app ID in the collection configuration. Google's [data stream reference](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams) defines these separate fields. A registered stream does not authorize analytics in a restricted target or prove receipt of events.

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

### Expanded collection

The consent-owned collector adds `analytics_version: 2`. It preserves the verified per-platform measurement IDs, which were reread from Firebase on 24 November 2026. Separate streams provide platform breakdowns within the same property; assigning multiple platforms to one stream does not add analytical coverage.

| Data | Events and fields | Interpretation |
| --- | --- | --- |
| Session engagement | `game_session_started`, `game_session_resumed`, `game_session_summary` | Summaries contain foreground milliseconds and interval counts for screens, attempts, puzzle/race starts and completions, help, checkout outcomes and failures. |
| Screen engagement | `game_screen_engagement`, `screen_name`, `game_mode`, `play_surface`, `foreground_ms` | Foreground dwell segments, flushed on a view change, backgrounding, page hide and each 60-second foreground interval. Idle foreground time is included. |
| Puzzle journeys | `level_start`, `level_resumed`, `level_end`, `riddle_skipped`, `level_replaced` | Private issued identities prevent recovery reads inflating browser starts. Completed observations include attempt/help counts and observed foreground journey time where correlation is sound. |
| Timing quality | `timing_scope`, `resumed` | `observed_start` and `resumed` describe the observed segment. `unobserved` omits duration. Overlapping unresolved rounds use `ambiguous` and suppress inferred durations for that mode until a new collector owns collection. |
| Load and action latency | `load_duration_ms`, `load_source`, native `game_load_result`, `operation_timing`, checkout/restore `duration_ms` | Request/load latency includes provider and save waits. It is distinct from foreground journey time. Polling is excluded from live-race action timings. |
| Content and progression | `game_locale`, native offline `content_version`, `category_id`, `difficulty`, `word_length` | Approved language and content classifications. Word length is the visible slot count, never the answer text. Available metadata depends on the platform's content contract. |
| Browser performance | `browser_navigation_timing`, `browser_performance_summary` | Numeric document load phases and observed foreground long-task/Event Timing aggregates. No resource URLs, DOM labels or typed values. Observed input durations are not a computed INP web vital. |
| Acquisition | Validated `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_content` map to standard GA campaign fields | Read only after consent and before first tag configuration. Values must be bounded campaign codes. Raw queries, referrers, search terms and ad-click identifiers remain excluded. Provider-only attribution stays in the provider's existing funnels. |
| Cohorts | `platform`, `game_locale`, `play_surface`, `app_release`, `network_state` | Web release labels use the release configuration; native app version remains an automatic Firebase dimension. Browser network state is its reported status, not a server reachability check. |

Counters in `game_session_summary` are deltas since the previous checkpoint, so summing that event is meaningful. Do not sum foreground milliseconds across session summaries, screen engagement and puzzle outcomes together, because they measure overlapping intervals. Puzzle foreground journey time includes foreground navigation/help between the observed start and outcome. It is not active solving time. Timing and counters begin only after a consented destination connects; revocation silently discards the final unfinished segment.

`purchase_confirmations` deduplicates stable web receipt identifiers locally within the observation window. Native checkout responses and web confirmations without stable receipt identity count outcomes, not unique financial transactions. Use GA's standard purchase/revenue metrics for financial reporting. Offline native actions must change an accepted save revision before they emit success or currency/progression events.

The implementation leaves automatic `first_open`, `first_visit`, `session_start`, engagement, device and app-version reporting to Google. It does not manually duplicate these reserved events or Play purchase revenue. Users remain analytics browser/app instances; the property does not establish a deduplicated count of global game accounts across platforms.

The [prepared reporting configuration](ga4-reporting-configuration.json) contains 22 event-scoped dimensions and 31 event-scoped metrics for property `545194073`. These are proposed definition bodies, not evidence of installed console definitions. Reuse any existing definitions by parameter name instead of creating duplicates. Use built-in GA dimensions for standard campaigns, device/app information and screen views.

For event-level history outside GA reports, Google's [BigQuery export](https://developers.google.com/analytics/bigquery/overview) supports raw event export. No export, paid resource or retention change was enabled. The available browser was signed out of Analytics, so property definitions, retention and export settings remain unapplied/unverified. A signed-in property administrator must apply the reviewed configuration and confirm property settings. Google documents the [dimension](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions) and [metric](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customMetrics) definition fields.

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

### Expanded collection verification

All seven production web builds and their artifact audits passed after the expanded collectors were added. Jest's entry-resource audit reports 576,679 bytes against its unchanged 576,716.8-byte limit. Shared/Android types, locale completeness, source boundaries, direct security configuration and whitespace checks passed. No additional automated game tests or browser/device harnesses were run. The Analytics console check was read-only and reached sign-in.

The final native release AAB is 48,442,322 bytes with SHA-256 `17916da4c0759fe853c890b020641003a033e851e8de82f3328764ebab0de6a9`. Its compiled Hermes bundle contains the final session, screen engagement, purchase confirmation and timing-scope fields. The Gradle bundle task now tracks shared `src` and selected hosted configuration inputs, so a shared collector edit cannot reuse a stale bundle. No build was uploaded, activated or deployed. GA ingestion, property reporting definitions, retention and export remain unverified/unapplied.
