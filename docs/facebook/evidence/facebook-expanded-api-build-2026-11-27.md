# Expanded Facebook API candidate — 27 November 2026

This unit extends the owner-requested `facebook` branch. It changes the local candidate; Meta still serves the version 9 artifact recorded in the [dashboard inspection](facebook-dashboard-api-prerequisites-2026-11-27.md).

## Reachable additions

- **Settings:** saved, default-off haptic feedback for authoritative successful Classic/Daily completions. Reduced motion, pause, hidden visibility and retired accounts suppress feedback. Privacy Policy and Terms of Use open the app's existing HTTPS destinations through Meta confirmation.
- **Race lobby, Facebook social panel:** connected-player and current-context participant counts, native friend-picker creation, return to solo, eligible native tournament listing/joining, and joining an observed Messenger Rooms context. Counts do not imply online presence. Raw social IDs never enter displayed copy or shared game state.
- **Race lobby, completed-race score action:** points derived from the verified five-minute race contract, submitted only by explicit player request and outside an existing native tournament. [Score definition and delivery](facebook-session-score-2026-11-27.md).
- **Host integration:** bounded platform/version/entry-source diagnostics, desktop display-mode observation with responsive remeasurement, and non-identifying activity metadata. No identity, balance, answer or referral data is attached to session metadata.
- **Optional native banners:** independent `loadBannerAdAsync` / `hideBannerAdAsync` support with reserved space, serialized dialog exclusion, lifecycle cleanup and existing server-authoritative ad-free eligibility. Deployment remains off until `VITE_FACEBOOK_BANNER_ENABLED=true` and `VITE_FACEBOOK_BANNER_PLACEMENT_ID` identifies an approved banner placement. Rewarded/interstitial IDs must not be reused. The adapter disables banner loading from 31 March 2027.

Each optional API requires advertised support and a callable method. Unavailable methods do not gain synthetic success. Player actions retain cancellation and retryable failure semantics.

## Integration corrections

Native matchmaking and context observation no longer depend on chooser availability. Native tournament score projection no longer depends on create/share availability. Tournament payloads accept the documented JSON-string representation, with bounded strict parsing. The SDK contract now represents POST contexts while authoritative group race membership remains restricted to the supported THREAD/GROUP types.

Independent review identified and corrected delayed native actions surviving their panel, rejected banner retirement preventing deletion retries, and stale checkout/context admission while waiting for banner cleanup. Settings actions now accept their mounted panel's abort signal and check it after banner cleanup, eligibility and save flushing. Already-admitted native mutations keep their original promises and reconcile the resulting context. New charges recheck the authenticated owner after recovery and immediately before opening checkout.

## Local evidence

`pnpm build:facebook` passed after session-scoring integration and the stale-admission corrections. It includes TypeScript, platform layout, target isolation, commerce activation checks, all 16 locale keys/placeholders, third-party notices, Vite and the Facebook artifact audit. Result: **418 files, 4.48 MB total, 0.69 MB initial resources**, with no Jest client, native module or secret leakage. Build output was retained locally at `/tmp/riddle-quest-facebook-api-build.log`.

The owner explicitly authorized focused automated tests and browser verification on 27 November. **316 tests across 23 focused suites passed**, including native-social cancellation/reconciliation, late banner loading and retryable cleanup, haptic opt-in/deduplication, legal destinations, host display retirement, verified score posting, context/dialog exclusion, saves/preferences, ad lifecycle, purchase recovery and checkout ownership. This includes the combined 311-test run, two additional Settings cancellation regressions, and three shared gameplay-fixture checks. Results are retained locally at `/tmp/riddle-quest-facebook-focused-tests.log` and `/tmp/riddle-quest-facebook-settings-tests.log`.

`git diff --check` passed. The full browser journey passed with `PORTAL_BROWSER_TESTS=1 pnpm exec jest --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts` (one suite, one integrated journey, 24.6 seconds). It builds a separate local artifact, uses an injected SDK and fake backend, and verifies startup recovery, authenticated saves, pause/resume/reload, context changes, sharing cancellation/retry, the third-win interstitial, rewarded continuation, account cleanup and tournament recovery/live results. New checks cover default-off vibration with on/off persistence, native privacy/terms destinations, and social counts without displayed IDs.

The harness now serves HTTPS and encodes/decodes real protected request/response envelopes. Its selector, capability-advertisement, rewarded-button and ad-cadence fixtures were brought up to date. A third distinct fake Classic puzzle permits an actual three-receipt browser journey without weakening production deduplication or ad policy. Browser log: `/tmp/riddle-quest-facebook-browser-tests.log`.

Mobile screenshots were inspected: [Facebook social panel](expanded-api-2026-11-27/native-social-mobile.png) and [Settings](expanded-api-2026-11-27/settings-mobile.png). These are local fixture evidence. Native Meta dialogs, real devices, approved payment hosts and the final uploaded artifact still require hosted acceptance. The read-only Meta dashboard inspection was not a game acceptance test.

## Completion limits

This is not a complete-submission claim. No artifact upload, activation, backend deployment, permission request, review submission or community invitation occurred. Private tournaments, Messenger bot approval/content integration, cross-play identity and cross-game destinations retain the prerequisites or gaps in the [complete API inventory](../facebook-api-research-2026-11-27.md). The [submission checklist](../facebook-api-submission-checklist-2026-11-27.md) tracks per-API evidence and remaining native acceptance.
