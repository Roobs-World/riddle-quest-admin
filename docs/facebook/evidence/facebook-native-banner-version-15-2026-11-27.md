# Banner-configured desktop check — Testing version 15

Riddle Quest Testing version **15**, bundle `30470981679157112`, was uploaded once from clean source `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0` on `facebook`. Meta completed processing and the candidate was explicitly assigned to Testing with SDK **8.0 [Network Enabled Zero Permissions]**. The independent provider download matched SHA-256 `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824` and **2,865,675 bytes**. Exact-artifact acceptance was recorded. Production remained version 9, bundle `29168977262783270`.

See the [machine-readable acceptance record](facebook-testing-version-15-2026-11-27.json) and [placement setup and local verification](facebook-banner-activation-2026-11-27.md).

## Configuration and local proof

The new **Riddle Quest Menu Banner** placement is `1748953042991569_1831460981407441`, in menu ad space `1831460568074149` under the existing RiddleQuest property `957348766757902`. Meta displayed **Ready to publish** after creation and again after this desktop check. This is the observed placement label, not a served-impression or complete-review claim.

The downloaded/hash-matched artifact's Facebook module contains the enabled banner flag and this exact placement ID. Its archive scan found no Qwordly text. Canonical preflight passed with 420 runtime files, 422 ZIP entries, 4.51 MB total and 0.71 MB initial resources, and no Jest gaming-platform, native-module or credential leakage.

Twenty focused banner/ad-configuration tests passed. The full injected-SDK browser journey passed in 33.923 seconds, including real entry/layout checks for reserved menu space, hiding before a native dialog, cancellation recovery, gameplay hiding and usable controls after no-fill. These are controlled external-boundary fixtures, separate from native host acceptance.

## Observed desktop outcome

1. Launched the exact version-15 Play destination. Startup was slow; after the Riddle Quest welcome appeared, selected **Let's Play**. The saved Classic coconut puzzle and **920 coins** returned.
2. Opened **Settings**. Its controls rendered normally, but the game contained **zero `.facebook-banner-layout` elements**, zero banner recovery overlays and no visible native banner. The adapter was not instantiated for this session; this was not an observed load rejection or no-fill response.
3. Closed Settings. **Settings**, **Multiplayer** and the first answer cell were enabled, with **920 coins** unchanged. No stale reservation or blocking recovery surface remained.
4. Refreshed the exact placement row in Monetisation Manager. It still showed **Banner**, the expected placement ID and **Ready to publish**.

The compiled enablement and placement are verified. This initial check did not capture a direct SDK support list or banner request/result trace, so it established only usable desktop fallback. The subsequent read-only diagnostic below resolves the advertised-method gate; it still does not establish no-fill, a real impression or successful native hiding.

No SDK replacement, HTTP fixtures, runtime injection, live account replacement, purchase, message, invitation, account deletion or notification opt-in was used in this native check. The only new provider configuration was the dedicated test ad space/placement. Firebase source, configuration and deployment remained unchanged. Earlier H12/H13/H14 observations retain their original versions; this check does not recertify their ads, sharing or quit journeys.

## Follow-up: native advertised capability gate

Opened Meta's built-in **IGDebug → SDK Info → Supported APIs** on this same version-15 session. The rendered panel identified SDK 8.0 and the exact app/bundle, and listed 49 advertised API names. It included **`hideBannerAdAsync`** but omitted **`loadBannerAdAsync`**. The [redacted names-only record](facebook-native-sdk-capabilities-version-15-2026-11-27.json) preserves the observation.

The existing banner factory requires both names in the advertised list. This host therefore fails that admission requirement even with the verified enabled flag and placement. It is appropriate for the client to omit the banner wrapper; no source fix or forced SDK invocation is warranted. This is evidence about the inspected desktop host, not a claim that banners are unavailable on every Meta host.

Only the rendered diagnostic panel was read. No JavaScript console command or SDK ad method was invoked, and no player or URL-parameter payload is retained in the evidence. The panel was closed afterward and Settings remained enabled. Real display/hide acceptance still requires a host that advertises both banner methods and satisfies the other existing gates.
