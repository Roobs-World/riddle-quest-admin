# Jest-only frontend

The `jest` branch has one game frontend, rooted at `platforms/web/jest`. Its SDK adapter, HTML entry, Vite build and release command belong to Jest. Other browser games, neutral distribution targets and the Android app have been removed from this branch.

Backend integrations remain in place. This cleanup does not change Firebase Functions, server exports, database rules, provider authorities, notification delivery or deployed services. Provider server directories remain under `platforms/web/<provider>/server` and `platforms/native/android/server`. The trusted Devvit gateway remains under `platforms/web/reddit/src/server` with its backend package and build configuration. The notification manager remains a separate service.

These provider source files are also backend dependencies and keep their existing paths:

- `platforms/web/jest/src/referrals/referralCampaigns.ts`
- `platforms/web/facebook/src/commerce/facebookCatalog.ts`
- `platforms/web/reddit/src/shared/redditCatalog.ts`
- `platforms/web/reddit/src/shared/redditPayloadTransport.ts`

Shared server codecs, pricing, rules and the supported content-locale registry stay unchanged. The game browser loads English only. Shared translated JSON catalogs remain data, with unused frontend keys removed consistently.

The root release registry exposes Jest only. `pnpm build:web` and `pnpm build:jest` build the Jest game. `pnpm build` retains backend preparation and compilation around that Jest build. `pnpm release:jest` retains its immutable upload and activation checks. Backend and notification-manager commands remain separate. Tests and browser harnesses still require an explicit request.

Removing the other entry points and adapters avoids retaining selectable browser targets behind disabled flags. Backend-used contracts remain at their existing locations so this frontend cleanup needs no backend migration.

Other platform documentation and dated evidence are historical frontend references or retained backend operations. They do not authorize restoring another game frontend on this branch.

The cleanup passed the Jest production build and artifact audit, full production type checks, locale and license checks, and the retained Firebase and Devvit gateway builds. A source comparison against the task's starting commit `518a2f222` confirmed the retained backend implementations, configuration and shared contracts were unchanged. The temporary Facebook catalog relocation from the earlier cleanup stage was reversed to preserve its original backend imports and staging path. Tests, browser harnesses and backend deployments were not run.

Google Analytics intentionally defaults to enabled unless storage contains an explicit `denied` preference. The security-configuration audit enforces that default on startup and cross-tab preference updates, persisted opt-outs, immediate revocation, production/session guards and disabled advertising. The audit was corrected to match that policy without changing runtime behavior.
