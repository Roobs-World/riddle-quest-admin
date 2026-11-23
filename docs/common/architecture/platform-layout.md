# Platform source ownership

Use `main` for every platform, shared source folder, release, Jest upload and monitoring repair. A platform's folder identifies its code owner. This keeps shared-controller changes and their web/native callers in one reviewable source revision. Confirm the current branch is `main`, then commit and push completed units to `origin/main` as work progresses. Separate platform, deployment and worker branches are no longer maintained.

## Target roots

| Target | Canonical source | Boundary |
| --- | --- | --- |
| Android / Google Play | `platforms/native/android` | Bare React Native app, native views, device bridges and Android-only server integration |
| Jest | `platforms/web/jest` | English-only HTML5 entry, Jest SDK adapter, identity/commerce integration and release scripts |
| Facebook | `platforms/web/facebook` | FBInstant entry, SDK adapter, Facebook-only ads, provider authority and release scripts |
| Reddit | `platforms/web/reddit` | Browser adapter, Devvit package and trusted same-origin gateway; Firebase integration in `server` |
| YouTube | `platforms/web/youtube` | Self-contained Playable entry, YouTube save/lifecycle SDK and release packaging |
| Netflix | `platforms/web/netflix` | Self-contained candidate entry; approved partner capabilities remain absent |
| Yahoo | `platforms/web/yahoo` | Self-contained candidate entry; retained server integration does not authorize browser use |
| GameSnacks | `platforms/web/gamesnacks` | Self-contained target entry and GameSnacks adapter |
| 42 Neutral Handoff destinations | `platforms/web/<target>/release.json` | Destination-specific release metadata, with shared game implementation |

Each of the 49 web destinations owns its release definition in `release.json`. `scripts/release/release-targets.json` is the ordered list of destination names; `release-registry.mjs` loads the definitions. Neutral Handoff destinations do not gain invented SDK adapters or copies of the game.

Platform-only source, tests, HTML, SDK code, views, native bridges, provider server integration and release scripts belong beneath the corresponding root. Browser source uses `src`. Firebase-side provider code uses `server`. Reddit's Devvit `src/server` is a separate trusted runtime from its Firebase-side `server` directory.

Common source lives in feature folders such as `src/gameplay`, `src/races`, `src/accounts`, `src/commerce`, `src/progression`, and `src/content`. Each feature groups its components, rules, controllers, and runtime adapters. Shared application composition lives in `src/app`; cross-feature capability contracts and Firebase adapters live in `src/platform`. Common browser build tools remain in `scripts/web/`, and translations stay in `src/locales/`.

These are ordinary folders governed by root `package.json`, `tsconfig.json`, `vite.config.ts`, and `jest.config.cjs`. They have no separate package configuration or generated package builds. Callers import canonical implementations directly. Cross-feature aggregate entry points and files that merely re-exported another implementation have been removed. See the [feature source analysis and rationale](shared-source-layout.md).

Provider-only controllers and contracts follow the provider even when both its client and server use them. Facebook's catalog lives in `platforms/web/facebook/src/commerce`; Reddit's catalog lives in `platforms/web/reddit/src/shared`. Jest's referral campaigns live under its `src/referrals`. Android's account, Google identity, billing, notification, referral, and entry controllers live in its native source tree. Shared authoritative gameplay and Firebase infrastructure remain in `firebase-functions/src`, grouped by [server responsibility](functions-source-layout.md). Decide ownership by behavior and callers rather than an old provider-prefixed filename.

## Build and archive contracts

Root `pnpm build:<target>` and `pnpm release:<target>` commands retain their provider-specific behavior. Vite selects one provider HTML root and one SDK integration at compile time. Local development serves the selected target at `/`. Each successful build audits resolved source ownership and runtime packages before accepting the artifact. Web artifacts exclude native modules and foreign provider SDKs. Outputs remain under `builds/<target>`; release receipts and exact-byte evidence retain the paths reported by their release command.

Android remains one native workspace. Its Gradle project, signing configuration and device helpers move together; shared imports resolve directly to root `src/` folders. Machine-local configuration and upload keys remain ignored and private. Changes to native directory depth require updating Metro, TypeScript, test aliases and device/emulator repository-root calculations together.

Firebase still deploys only `firebase-functions`, with Node 22, its existing regions, and zero reserved warm instances. Every Functions build recreates the ignored `.build-source` tree inside that directory, clears old compiled output, and audits the resulting archive. The Firebase predeploy hook runs that same build command.

Preparation copies canonical shared source and provider server dependencies into repository-shaped paths within `.build-source`. An archive-local CommonJS boundary preserves server emission without rebuilding or vendoring a shared package. TypeScript follows imports from the authoritative server entries and creates the archive-local `lib` tree. Staging a browser source file does not include it in the compiled deployment graph. The Functions entry is `lib/firebase-functions/src/index.js`. Generated source copies and compiled output are build artifacts. Maintenance scripts, source discovery, export and capacity audits, and cycle checks follow those same canonical roots.

Game uploads require an explicit user request. Source changes, builds, commits, and pushes do not authorize uploads. Jest release preparation retains its clean-source snapshot, Bubblewrap isolation, credential permissions, token-on-stdin boundary, source/artifact hashes and upload receipts. Uploads run from `main`. Processing completion must be observed before reporting an upload complete. Activation requires explicit authorization; publication and review submission remain separate. Jest end-to-end checks use hosted unpublished previews when testing is requested.

## Directory size

Project-owned directories contain at most 20 direct non-test files. Tests are exempt and remain in their existing locations. Installed dependencies and generated or ignored build outputs are excluded. Split production files by responsibility and move callers with the canonical source. See the [Functions source layout](functions-source-layout.md) for the backend application of this rule.

## Verification and history

Run tests and browser harnesses only when explicitly requested. Build the artifacts needed for a change or upload, and use the static platform-layout and dependency guards to check source placement. GitHub Actions remains manual-only behind its runner-usage confirmation gate; ordinary commits and pushes do not authorize hosted runs.

Active operational documents use current paths. Dated evidence, research and historical ADRs retain the paths and revisions that were actually observed. For those older records, `packages/core`, `packages/solo`, `packages/hosted`, and `packages/web-game` describe the former shared workspaces. Earlier records use `packages/portal` for the web client, `packages/android` for the native root, and `packages/reddit-app` for the Devvit root. The intermediate `src/core`, `src/solo`, `src/hosted`, and `src/web` folders also appear in older records. Use the feature layout to find current owners rather than rewriting historical results.

The Sentry background worker remains in `tooling/sentry-worker`. Its automated repair policy covers shared source plus Jest/Facebook source, server code and scripts. Native and other provider roots remain outside that policy. Repair PRs target `main`. Signed main-base checks, deployed-version verification, exact-head merge checks and deployment authority remain required. See [the worker runbook](../../sentry-worker/README.md).
