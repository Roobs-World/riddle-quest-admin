# Platform source ownership

The `jest` branch contains one game frontend. Read the [Jest-only frontend boundary](../../jest/jest-only-frontend.md) before changing source ownership. Other provider backends and the notification manager remain intact.

## Game frontend

`platforms/web/jest` owns the Jest HTML document, SDK adapter, views, browser tooling and release scripts. Shared browser gameplay lives in feature folders under `src`, including `gameplay`, `races`, `accounts`, `commerce`, `progression` and `content`. Root dependencies and configuration govern shared source.

There are no other game browser entry points, native app builds or neutral frontend release destinations on this branch. Browser source and artifacts must exclude native modules and other provider SDKs.

## Retained backends

Authoritative shared services stay in `firebase-functions`. Provider server modules remain in their existing directories:

- `platforms/native/android/server`
- `platforms/web/jest/server`
- `platforms/web/facebook/server`
- `platforms/web/reddit/server`
- `platforms/web/yahoo/server`

The Devvit gateway remains in `platforms/web/reddit/src/server`. Its server Vite configuration, package dependencies, TypeScript configuration, deployment metadata and backend contract-validation helpers remain available. Its browser frontend is absent.

Backend-used catalogs and shared codecs retain their existing paths and behavior. Facebook's backend-used catalog retains its original path at `platforms/web/facebook/src/commerce`; Reddit's remains in `platforms/web/reddit/src/shared`. Jest's referral campaigns remain under `platforms/web/jest/src/referrals`.

The notification manager remains a separate workspace. This frontend cleanup does not alter its API, database schema, configuration, frontend or delivery workers. The Sentry background worker remains in `tooling/sentry-worker`.

## Builds and releases

The browser release registry contains Jest only. Its runtime output is `platforms/web/jest/build/dist`; archives and private receipts remain outside that runtime folder. `pnpm build:jest` builds and audits the game. The root `build:web` alias builds Jest. `build` retains backend preparation and compilation around the Jest build. Explicit backend and notification-manager build commands remain available.

Follow the standing Jest upload and activation authorization in [AGENTS.md](../../../AGENTS.md) and the [Jest release runbook](../../jest/jest-html5-operations.md#build-and-upload). A completed Jest game build is followed by the canonical release command unless the user requests otherwise. Publication, review submission and hosted GitHub runner usage remain separate.

Functions still uses its existing Node 22 runtime and source-staging process. Every Functions build recreates `.build-source`, compiles the canonical server imports and audits its deployment archive. Removing game frontends does not change those server imports, exports, rules or deployed services.

## Verification and history

Run tests and browser harnesses only when explicitly requested. Use production builds, type checking, locale validation and source/artifact guards for this cleanup. Each project-owned Functions directory stays below the existing 20-file limit; tests and generated output are exempt.

Historical platform runbooks, assets, ADRs and dated evidence remain with their modules. They describe the revisions that were observed and do not restore removed frontend targets. Root discovery files and agent tooling retain their required locations.
