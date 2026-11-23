# Shared feature folders

Riddle Quest groups common source by game feature under root `src/`. A feature keeps its rules, controllers, views, and adapters together. Root `package.json`, `tsconfig.json`, `vite.config.ts`, and `jest.config.cjs` govern these folders. Features have no separate manifests, workspace dependencies, build outputs, or configuration.

## Feature ownership

| Folder | Responsibility |
| --- | --- |
| `src/gameplay` | Guess input, scoring, local authority, server-confirmed sessions, checkpoints, saved games, and gameplay components |
| `src/races` | Race contracts, discovery, lobbies, live play, recovery, history, and race components |
| `src/accounts` | Profiles, avatars, username validation, account views, and account adapters |
| `src/commerce` | Shared pricing, purchase recovery, shop views, and checkout presentation |
| `src/progression` | Economy rules, achievements, rewards, player statistics, and progression views |
| `src/content` | Bundled catalogs, content loading, generated content, and protected-content transport |
| `src/localization`, `src/locales` | Locale helpers and copy controllers, followed by the translated JSON catalogs |
| `src/app` | Application composition, layout, modal routing, recovery presentation, and test support |
| `src/platform` | Shared capability contracts, iframe messages, backend contracts, and Firebase adapters |
| `src/scenery` | Solar-system rendering, spacecraft, motion, and visual effects |
| `src/onboarding`, `src/settings` | Guidance, preferences, and their components and adapters |
| `src/presence`, `src/sharing`, `src/leaderboards`, `src/notifications` | Shared presence, sharing, leaderboard, and notification support |
| `src/observability` | Error reporting, privacy filtering, and shared telemetry controls |

## Structure within a feature

Keep presentation under `components/` and place a focused component's helpers and styles beside it. Split large view groups by purpose, such as race lobbies, invitations, history, and gameplay.

Use `rules/` or `contracts/` for pure calculations and validated data. Put reusable state and workflow controllers beside those rules. Browser events, storage, DOM code, and timers belong in `browser/` or browser hooks. Firebase-specific transport stays in `transport/` or `src/platform/firebase`. Shared React hooks that work in both web and native hosts remain separate from browser adapters.

For example, race schemas live in `src/races/contracts`, controllers in `src/races/controllers`, and presentation in race component folders. Local game authority lives in `src/gameplay/local`; its save transport remains supplied by the target. Shared hosted session recovery lives in `src/gameplay/session`, with focused `checkpoints`, `journal`, and `completion` folders. Race helpers group discovery under `matchmaking`, saved state under `drafts` and `recovery`, and projections under `history`, `presentation`, and `rounds`.

## Analysis and choice

The review followed entry points, imports, runtime dependencies, and callers in all four former source trees before moving files.

| Former source tree | Feature destinations |
| --- | --- |
| Core rules and schemas | Gameplay, races, progression, commerce, accounts, localization, and shared platform contracts |
| Local solo play | Gameplay authority and persistence, bundled content, local economy, achievements, and shared copy |
| Hosted play | Gameplay sessions, race controllers, accounts, purchase recovery, and Firebase transport |
| Browser game | Feature components, browser adapters, scenery, application composition, and observability |

The alternative was to group source by player journey, such as Classic, Daily, offline play, and live races. Classic, Daily, and offline play share scoring, input, rewards, and persistence. Keeping those mechanics canonical would require another large shared layer. Direct feature folders keep that shared behavior near its views while making runtime dependencies explicit below each feature.

Some shared types and controllers retain `YouTube` in their names. Multiple web targets and Android consume them, so the names do not establish provider ownership.

## Canonical implementations

Cross-feature entry points and browser files that only re-exported shared implementations have been removed. Callers import the canonical implementation directly. A few narrow entry points remain where they describe one feature API, such as race contracts, pricing, and local React hooks.

Files that add browser clocks, storage, or lifecycle behavior remain adapters. They are not replaced with aliases to a controller that lacks those host capabilities.

Provider-only code stays in `platforms/`, even when a provider's client and server share it. Facebook and Reddit own their product catalogs. Jest owns its referral campaigns. Android owns Google identity, Play Billing, notifications, account callables, referral controllers, and entry codecs. Shared purchase recovery stays in `src/commerce/recovery` because both Jest and Android consume it.

## Configuration and runtime boundaries

Common browser build tools remain in `scripts/web/`. Root commands select target builds and static checks. The root Jest configuration selects the `rules`, `local-game`, `services`, and `interface` verification groups without adding configuration to feature folders. Those groups describe verification responsibility rather than source ownership.

Android, Reddit's Devvit server, and Firebase Functions retain configuration for their separate device and deployment runtimes. Metro resolves shared source directly and uses Android's React and Firebase instances. Functions stages repository-shaped shared and provider source, then compiles the graph reached from authoritative server entries. Browser components and provider SDKs do not enter its compiled archive merely because source was staged.

The [platform ownership guide](platform-layout.md) defines target isolation, archive boundaries, and release controls.
