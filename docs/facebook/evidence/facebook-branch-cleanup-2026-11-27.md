# Facebook branch cleanup — 27 November 2026

**Scope correction:** The owner subsequently clarified that all Jest backend integrations must remain. The backend and monitoring removals recorded below were reversed; see [client isolation with retained Jest backend](facebook-client-backend-boundary-2026-11-27.md). This earlier record describes commit `b54e9d501`, not the final corrected scope.

The owner requested a Facebook branch based on `web`, followed by removal of the Jest game provider and verification of Facebook API replacements. This source change does not publish, upload, activate, deploy or change live data.

## Removal and replacement

- Removed `platforms/web/jest`, its SDK dependency and screenshot renderer, Vite target, release registry entry, upload workflow, and Firebase Hosting shell.
- Removed Jest HTTP exports, server staging, authentication/provider branches, notification registration route and planner, SDK milestones, registration UI and platform-specific preference fields.
- Retained canonical shared account deletion, operation leases, purchase catalogs and invitation lifecycle with provider-neutral names. Facebook generation-aware identity, receipt verification, grant-before-consume ordering and referral authority remain in their platform modules.
- Restored explicit account-management capabilities in the shared profile and explicit analytics opt-in. Removed obsolete text from all 16 supported locales.
- Fixed the optional Meta product description contract; protected asynchronous ad presentation and browser-state mutations when the Facebook account retires.
- Removed obsolete Jest artifact harnesses; retained shared/Facebook fixtures and foreign-SDK rejection checks. The Jest test framework remains.
- Removed Jest monitoring inventory calls. Signed main-base, exact-head and deployed Functions authority checks remain; unsupported frontend deployment authorities fail closed.

[Facebook API coverage](../facebook-instant-games-operations.md#facebook-branch-api-coverage) maps each responsibility to its implementation and official contract.

## Verification

| Check | Result |
| --- | --- |
| Facebook production build and artifact audit | Passed: 418 files, 4.45 MB total, 0.66 MB initial resources; no Jest/native/secret leakage |
| Functions production build | Passed: 268 modules, deployment-artifact and capacity audits |
| Production source types | Shared browser, Functions, Android, Reddit and notification manager passed |
| Target layout and imports | Passed: 6 web applications, 48 release owners; no cross-provider source edges |
| Locales and Facebook visible copy | Passed: 16 locales, 23 namespaces; 704 required Facebook translations |
| Security, monetization, Facebook secret/profile boundaries | Passed |
| Functions folder layout | Passed: 44 folders, largest 18 direct non-test files (limit 20) |
| JavaScript syntax and JSON parsing | Passed for changed root/tooling files and remaining web tooling |
| Git whitespace check | Passed |

Unit tests and browser test harnesses were not executed, following repository policy. An optional backend test-source typecheck did not pass because of fixture and module-resolution errors; it is not a production typecheck or a passing test result. No claim of Meta-hosted gameplay, live checkout, notification delivery, ad availability or review readiness is made.

## Persisted-data compatibility

The shared account-deletion constant retains the physical `jestAccountDeletionTombstones` collection name so existing deleted identities stay blocked. Retired notification-consent SQL stays in the desired schema and immutable migration history so later schema comparison cannot silently propose deleting stored data. Neither has an active Jest game API. Historical documentation, ignored release receipts and anti-leakage patterns remain as records and safeguards.
