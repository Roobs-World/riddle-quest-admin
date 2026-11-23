# Shared source folders

Riddle Quest keeps common client code in root `src/`. These folders share the root package manifest, TypeScript configuration, Vite configuration, and Jest configuration. They have no package manifests, build outputs, workspace dependencies, or per-folder configuration.

## Analysis before the move

Each former package source tree was reviewed through its entry points, imports, runtime dependencies, and callers before it moved.

| Former source | Current folder | Findings |
| --- | --- | --- |
| `packages/core/src` | `src/core` | Framework-independent game rules, Zod schemas, bridge contracts, shared pricing, races, and referrals. Browser clients, Android, and Functions consume these files. |
| `packages/solo/src` | `src/solo` | Local gameplay authority, bundled content, save recovery, economy, achievements, translations, answer editing, and React controllers. Android and the self-contained web targets share these files. |
| `packages/hosted/src` | `src/hosted` | Firebase callable transport, host services, profile mapping, hosted gameplay, race state, and purchase recovery. Browser clients and Android share these files. |
| `packages/web-game/src` | `src/web` | Browser presentation, rendering, input, storage, observability, and self-contained game views. Platform entries compose this shared UI with their own adapters. |

The existing subfolders remain together because they already separate pure rules, local play, hosted play, and browser presentation. Regrouping every file by feature would also change those responsibilities and obscure which files require a browser or Firebase. Folder names describe source ownership rather than separately built modules.

Some shared solo types and controllers retain `YouTube` in their names. Android, Netflix, Yahoo, GameSnacks, and YouTube consume those contracts, so their names do not establish provider ownership.

## Provider-only source

Files used by one provider live beneath that provider's `platforms/` root, including files shared by its browser and server runtimes.

- Facebook product contracts live in `platforms/web/facebook/src/commerce/facebookCatalog.ts`.
- Reddit Gold product contracts live in `platforms/web/reddit/src/shared/redditCatalog.ts`.
- Android account callables, Google identity, Play Billing, notifications, referral controllers, and entry codecs live in the native app's corresponding source folders.
- Provider SDK adapters, server integrations, HTML entries, tests, assets, and release scripts remain under their platform root.

The shared pricing barrel exports only common pricing. It does not expose the Facebook or Reddit catalogs. The shared purchase-recovery controller remains in `src/hosted/commerce` because both Jest and Android use it.

## Imports and configuration

Source files import common code directly through relative paths. The removed `@riddle-quest/core`, `@riddle-quest/solo`, `@riddle-quest/hosted`, and `@riddle-quest/portal` package identities have no compatibility aliases or workspace dependencies.

Shared browser build tools live in `scripts/web/`, including `scripts/web/build/`. Translations stay in `src/locales/`. Root commands such as `pnpm build:jest`, `pnpm build:facebook`, and `pnpm check:types:shared` select the relevant build or check. The root Jest configuration selects the `core`, `solo`, `hosted`, and `web` source groups.

Android, Reddit's Devvit server, and Firebase Functions keep configuration for their separate runtimes. These deployment or device boundaries do not turn common source folders into packages. Metro resolves shared source directly and uses Android's React and Firebase instances. Functions stages `src/core` and the provider server dependencies inside its deployment archive before compilation.

The [platform ownership guide](platform-layout.md) defines target isolation, deployment archives, release controls, and historical path handling.
