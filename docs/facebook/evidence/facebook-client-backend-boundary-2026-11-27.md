# Facebook client isolation with retained Jest backend

The owner clarified that only the Facebook client should lose Jest boilerplate. All Jest integrations must remain in the backend. This supersedes the backend-removal scope of `b54e9d501` and its [earlier cleanup record](facebook-branch-cleanup-2026-11-27.md).

## Backend restoration

The baseline is `c3b74fa37`, immediately before the cleanup. All 682 files in Firebase Functions, platform server folders and the notification manager were restored. Of these, 675 are byte-identical to baseline. Seven differ only because two pure contracts moved from the removed Jest client tree into `platforms/web/jest/server` and their imports/staging paths changed. No baseline backend file is missing.

The production Functions build exports all seven Jest integration endpoints: `exchangeJestIdentity`, `grantJestPurchase`, `retryJestAccountDeletion`, `syncJestSubscriptions`, `verifyJestReferrals`, `syncJestAvatar` and `getJestNotificationPlan`. Jest race/presence authorization, notification preferences, account lifecycle, receipt ledgers, rules, indexes and deployment validation remain. The notification manager's Jest registration and planning routes remain active in source.

The only changed shared source module in the compiled backend graph is the race schema: it accepts both persisted `jest-invite-` identifiers and `race-invite-` identifiers. Existing identifiers are not renamed or invalidated.

Backend monitoring again reads the Jest deployed-version inventory. Signed `main` authority, exact-head checks and Functions deployment verification remain required. The repair scope permits Jest server files without permitting the removed Jest client to be recreated.

## Client boundary

The Jest browser entry, SDK, build/release target and upload workflow remain absent. Vite inventories every resolved module and rejects foreign provider roots, server modules and undeclared runtime packages. Facebook's final-byte audit separately rejects Jest SDK/configuration/sharing bridges.

Unused registration, subscription-management and premium-shop presentation chains are removed from the shared browser client. Android subscriptions and all Jest backend subscription handling remain intact. Facebook uses its one-time catalog and durable ad-removal entitlement.

The [Facebook operations guide](../facebook-instant-games-operations.md#facebook-branch-api-coverage) maps identity, saves, payments, invitations, contexts, tournaments, notifications, ads and lifecycle to their production call paths. SDK availability checks constrain optional actions; no API is called merely to make an inventory appear complete.

Native matchmaking now has a caller in the active race UI. It is exposed only when advertised and uses a same-language tag. The adapter consults advertised `checkCanPlayerMatchAsync` before opening the native dialog. A failed, cancelled or ineligible operation reconciles the actual SDK context, preserving an existing server membership unless the native context really changed.

Advertised `player.getAgeCategoryAsync` narrows the configured release audience: `TN` and `AD` retain the approved 13-plus gate; unknown or failed responses disable optional features. Bootstrap and authenticated entry use the same decision. The unused bot-subscription adapter, prompt wrappers/parsers and saved prompt fields are removed; Settings still reaches the notification manager's A2U consent flow.

Meta's old global-leaderboard API is [deprecated and rejects calls](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference#global-leaderboards-fbinstantgloballeaderboards--deprecated). The game's authoritative leaderboard remains on its backend. Current v8 player data and authoritative profiles cover progress/statistics; obsolete statistics wrappers are not introduced.

The current [v8 core](https://developers.facebook.com/documentation/games/sdk-reference/v8.0) and [player](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) references also expose optional features that this game does not need. Cross-app identity migration, community links, shortcuts, cross-game navigation, banner ads and native quit prompts have no configured product action here. Messenger bot subscription is separate from A2U. Session-score posting would require a comparable score across the game's different modes; tournament results already use server-confirmed elapsed time. These APIs are deliberately absent rather than called without a supported user flow.

## Verification boundary

Verification uses source/API tracing, source comparison against the pre-cleanup backend, production compilation, module inventories, final artifact inspection and static audits. Unit tests and browser harnesses are not run under the repository's test-authorization rule. No backend deployment, Facebook upload, activation, review submission or live data mutation is performed.

Completed local checks:

- `pnpm build:facebook` passes, including target boundaries, commerce activation, locale completeness, licenses, TypeScript compilation and the final artifact audit. The artifact has 418 files, 4.43 MB total and 0.66 MB initial resources.
- The final dependency inventory contains 1,092 resolved modules and 19 runtime packages. All 418 emitted file hashes match the inventory. No Jest platform module, native module, server module, Jest callable name, Jest SDK/configuration marker or removed bot-subscription adapter appears in the checked client graph/artifact.
- The restored Functions production build passes its directory, module-cycle, deployment-artifact and capacity audits: 282 modules, 1,449 dependency references and 566 upload files. Its compiled entry exports all seven Jest endpoints listed above. All 36 compiled shared source modules match the staged source; only the strict invitation schema differs from the pre-cleanup baseline.
- Android, Reddit and notification-manager production typechecks pass. Security configuration, backend scalability, Facebook secret/profile boundaries, monetization and visible-copy audits pass. The visible-copy audit covers 688 required translations across all 16 locales.
- Changed JavaScript tooling parses successfully and `git diff --check` passes. Independent source review found the native-match membership edge case described above, and confirmed the correction.

Compilation ran locally with Node 24.17.0; Functions declares Node 22 as its deployed runtime. These checks do not establish hosted SDK availability or live payment, ad, notification or matchmaking behavior.
