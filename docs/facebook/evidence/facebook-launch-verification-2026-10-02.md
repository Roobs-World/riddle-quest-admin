# Facebook launch verification — 2 October 2026

Operator: Codex. Project: `riddle-quest-ec2b2`. Meta app: `1748953042991569` (Riddle Quest).

This is a sanitised local/read-only progress record. It is **not** a deployment receipt, hosted-device acceptance, payment verification, review approval or publication approval. No Meta settings, live database records, TTL policies, secrets, production functions or feature switches were changed. No bundle was uploaded or promoted.

Source HEAD when checked: `8dc08e65f3a72f964137e68eff70487eb7bbf700`. The workspace contains extensive concurrent uncommitted changes. Results concern the files present when each command ran, not an immutable candidate made from HEAD. All release gates must be rerun after the reviewed source is frozen.

## Completed local verification

| Check | Result | Limit |
| --- | --- | --- |
| `pnpm check:security` | Passed; 7 fixture tests and repository/CI audits | Does not establish production IAM or secret rotation |
| Facebook secret audit | Passed; 3 fixture tests | Does not prove provider secret issuance |
| Facebook profile-boundary audit | Passed; 3 fixture tests | Hosted provider overlays remain unaccepted |
| Facebook commerce-activation audit | Passed; 3 fixture tests | Commerce remains deliberately disabled without verified authority |
| Facebook visible-copy audit | Passed; 16 locales, 720 required translations | UI key coverage, not complete riddle translations |
| Locale audit | Passed; 16 locales × 23 namespaces | Not linguistic/cultural review |
| Target-boundary audit | Passed; 11 fixture tests, 254 source files, 1,044 module references on follow-up | Target artifacts still need release-specific re-auditing |
| Third-party license check | Passed; notices current | No listing/legal review implied |
| `pnpm check:types` and core build | Passed | No frozen candidate |
| Portal release-script suite | 135 tests passed | No real Meta upload performed |
| `pnpm test` | Core: 26 suites / 225 tests; portal: 219 passed suites / 1,809 passed tests; Reddit server/package: 42 tests | Browser suites were separate |
| `pnpm verify:functions:node22` | Node 22.23.1; types/lint and 117 suites / 1,430 tests passed | The root shell is Node 24; this separate run verifies Functions under Node 22 |
| `pnpm preflight:facebook-backend` | Passed environment/export/deployment-script validation, types, lint, tests and deploy build | No deployment; passing environment shape does not prove IAM or hosted requests |
| `pnpm --dir firebase-functions test:race:rules` | 47 suites / 526 tests passed; emulators shut down successfully | Disposable local demo project only |

The six required release builds passed: `pnpm build:jest`, `pnpm build:facebook`, `pnpm build:reddit`, `pnpm build:youtube`, `pnpm build:netflix`, `pnpm build:yahoo`. Each target's applicable bundled-content/artifact checks ran as part of its build. The complete YouTube corpus gate passed; that does not resolve Facebook race-content translation work.

**Later source change invalidates a current all-green claim:** At 00:17 UTC a fresh Jest rebuild failed with TS2353 in concurrently added `packages/core/src/validation/dailyCalendar.ts:6`: the timezone map defines `zh`, which is outside `SupportedLocale`'s 16 locales. That runtime file was left untouched to preserve its author's work and avoid inventing a locale decision. The build reached passing boundary/locales/licenses/manifest checks, then stopped at TypeScript; the long hosted test did not execute in that fresh-build attempt. Resolve the map/locale mismatch with its author and rerun types plus all six builds. Subsequent old-build browser probes cannot certify the changed source.

The Facebook injected harness's artifact audit reported 399 files, 4.19 MB total and 0.55 MB initial resources. These figures describe that audited harness build, not a production upload fingerprint. No immutable release ZIP/hash was created in this run.

## Browser checks and repairs

| Surface | Result | What it proves |
| --- | --- | --- |
| Facebook injected browser | 1/1 passed | Mock SDK/core smoke, not Facebook's actual runtime or phones |
| YouTube injected browser | 10/10 passed | Local self-contained/save/guard scenarios |
| Netflix/Yahoo candidate browser | 2/2 passed | Local candidate harnesses, not partner approval |
| Jest initial full game-browser gate | 4 suites failed; 3 passed; 11 failed / 7 passed tests | Triggered the investigation below |
| Jest follow-up full game-browser gate | 1 suite failed; 6 passed; 1 failed / 17 passed tests | The remaining long hosted test still assumed a four-step Classic tour while starting Daily |
| Reddit injected browser | Failed at `redditBrowser.jest-playwright.test.ts:649` waiting for the Arabic retry action | Unresolved; no passing whole-target browser gate claimed |

The debugging skill was used to reproduce the Jest failures and compare three explanations: stale Classic assumptions, platform onboarding overriding storage hints, or mismatched builds. A direct Playwright probe showed that storage flags did not dismiss platform onboarding; after normal onboarding, the page started Daily with the ECHO riddle and no Skip. This is consistent with the deliberate Daily-first session policy, not a reason to revert that policy.

Completed test-only changes:

1. `instructionsModalScroll.jest-playwright.test.ts` now calls the existing normal onboarding helper instead of assuming browser storage wins. Focused result: 1/1 passed.
2. `coinCollection.jest-playwright.test.ts` now seeds `dailyCompleted=1`, the existing trusted-harness route to post-Daily Classic play. Focused result: 1/1 passed.
3. `queuedCoinActions.jest-playwright.test.ts` uses the same seed for its Classic-only paid Skip/Hint scenarios. Together with coin collection: 9/9 passed.
4. The long `hostedBrowser.jest-playwright.test.ts` was subsequently given the same seed for its Classic pages. Its dedicated Daily page remains unseeded, preserving Daily coverage. The old-build diagnostic now passes the original tour failure and later fails at line 768 waiting for the Race Debut achievement popup. This remains unresolved; the assertion was not removed or weakened.

The subsequent fresh-build attempt was blocked by the type error described above; an explicitly `PORTAL_USE_EXISTING_BUILD=1` rerun was started only to diagnose/test the fixture migration against the previously built artifact.

Existing build-directory overrides and other user changes were preserved. No gameplay/runtime policy or locale text was changed. The full Jest script short-circuits before authentication when the game-browser gate fails, so authentication was also started separately rather than being assumed passed. The separate authentication run was stopped at 00:19 UTC without a final test result once the current-source type blocker and old-artifact mismatch were established. It is **not** a passing authentication gate and must be repeated after a fresh successful build. The Functions lockfile dry-run passed before that separate run started.

## Live Meta observations

Authenticated connector access now works and is read-only for this app. The app list identifies the correct app and administrative role; this does not grant this tool mutation capability.

Basic settings returned:

| Field | Observed value |
| --- | --- |
| App name | Riddle Quest |
| App status / public availability | `dev_mode` / `is_live: false` |
| Contact email | Existing support address; `contact_email_verified: false` |
| Privacy notice | `https://roobsworld.com/riddle-quest/privacy` |
| Terms | `https://roobsworld.com/riddle-quest/terms` |
| `data_deletion_url`, `support_url`, `base_domains` | `null` |

Signed-out HTTP requests followed redirects and returned 200 for privacy and terms. This only checks reachability. Empty API fields do not prove a separately configured signed callback or game-detail field is absent; the owner must reconcile those dashboard settings before saving anything.

Review results are contradictory:

1. Status: `submission_status: UNSUBMITTED`, `is_approved: true`, `is_pending: false`; submitted/review timestamps absent.
2. Requirements: `can_submit: false`, with a message that a previous submission is in review. It also reports privacy policy present, `business_verification_passes: true`, and completed Zero Permission Access data-use checkup.
3. History: no submissions and `has_been_previously_reviewed: false`.
4. Compliance: compliant, with no open violations or required actions.

These responses do **not** demonstrate Partner, game-quality or public-launch approval. The owner should open the specific review panels, distinguish each review type, retain its actual reference/status and ask Meta to reconcile the conflicting signals if they persist. Do not retry review submissions blindly.

## Live Firebase observations

Read-only project discovery confirmed the correct production project. The root Firebase Hosting target serves Jest; it is not the Facebook upload path.

Deployed inventory contained 90 Functions, including 15 Facebook-named functions in `us-central1`. `facebookContextRetentionScheduler` was absent; an exact metadata lookup returned 404. Its local implementation is not proof of deployment.

Metadata checks:

| Function | Runtime / state | Revision / observed configuration |
| --- | --- | --- |
| `getFacebookClientConfiguration` | Node 22 / ACTIVE | `getfacebookclientconfiguration-00018-mec`, updated 2026-10-01 01:48:42.594 UTC |
| `issueFacebookIdentityNonce` | Node 22 / ACTIVE | `issuefacebookidentitynonce-00018-taw`, updated 2026-10-01 01:48:36.805 UTC |

Both inspected functions' deployed environment disables `commerce,rewarded_ads,notifications`. This is not an end-to-end request test and does not prove every deployed function has identical configuration. Leave these safety gates unchanged until the individual feature acceptance is complete.

`expiresAt` TTL metadata:

| Collection group | Observed policy |
| --- | --- |
| `facebookIdentityRateLimits` | ACTIVE |
| `facebookIdentityNonces` | No enabled TTL policy |
| `facebookReferralTokens` | No enabled TTL policy |
| `facebookContextCompetitionHistory` | ACTIVE |
| `facebookTournaments` | ACTIVE |
| `entries` | ACTIVE; operator still needs to review group-wide scope |

Authenticated API credentials remained inside the read process and were not printed/saved to this evidence. Only aggregate operational findings are recorded here.

## Retention previews — no writes

Commands were run without `--apply`:

```sh
pnpm --dir firebase-functions facebook:nonces:retention --project riddle-quest-ec2b2 --page-size 100
pnpm --dir firebase-functions facebook:referrals:retention --project riddle-quest-ec2b2 --page-size 100
pnpm --dir firebase-functions facebook:contexts:retention --project riddle-quest-ec2b2 --limit 20
```

1. Nonces: 13 scanned, 13 ready for backfill, zero already ready, missing or invalid; complete scan.
2. Referrals: zero scanned, invalid, excessive bindings or binding updates; complete scan.
3. Contexts: zero scanned, ready, missing, active, invalid or entries; complete scan.

An empty preview is not proof that scheduled cleanup works. A complete dry-run is not a completed backfill. Re-preview immediately before an authorised apply because live state may change. Backfill relevant legacy rows and confirm compatibility **before** enabling deletion policies; preserve existing immediate logical expiry checks.

## Newly found provider guidance

The authenticated Meta documentation search supplied current official references after legacy web URLs failed:

- [In-App Purchases](https://developers.facebook.com/documentation/games/monetize/in-app-purchases).
- [SDK v8 Payments](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments).
- [Games changelog](https://developers.facebook.com/documentation/games/changelog/).
- [Notification Service](https://developers.facebook.com/documentation/games/retain/notifications/notification-service).
- [Notifications overview](https://developers.facebook.com/documentation/games/retain/notifications/overview).
- [A2U API](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api).

The IAP tutorial and Payments reference list different signed claims and provide conflicting consume/provisioning advice. Player binding and grant-before-consume crash recovery must be resolved using the actual approved contract and private real fixtures; do not activate commerce based on a guessed merged schema. New V2 payment-webhook guidance is signposted in the changelog, but no app-specific refund signature contract was verified in this run.

The Notification Service guide describes managed scheduling/cancellation, whereas A2U is server-driven. This corrects the earlier inference that no scheduling documentation exists. It does not prove these managed methods are supported by this app's actual v8 runtime, permitted for it, or sufficient to cancel messages after server-side deletion. Obtain SDK support, permission and private delivery fixtures before implementation/activation.

## Next actions and ownership

Use [the shared launch checklist](../facebook-launch-todo.md) for the complete numbered procedures and claim a task there before acting.

1. Owner: resolve Meta contact/support/deletion configuration and review contradictions; confirm Partner status, listing/rating and launch scope.
2. Developer: close remaining browser/content gates and obtain accepted purchase/refund/notification contracts. Do not remove safety gates to make audits pass.
3. Cloud operator: review secret/IAM readiness and the full dirty Functions/rules diff; re-preview and approve maintenance; perform required backfills before a reviewed full-unit deployment/TTL activation. Prove scheduler and physical expiry.
4. Testers: collect real Facebook web/iOS/Android identity, deletion, lifecycle and enabled-feature evidence against an immutable Testing version.
5. Release owner: agree reviewed clean source, create the canonical immutable handoff, coordinate exactly one Testing upload and record real review/promotion evidence. Public publication still requires final owner approval.

Local build/test evidence cannot substitute for any of those external acceptance steps.
