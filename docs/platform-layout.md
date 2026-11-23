# Platform source ownership

Use `main` for every platform, shared package, release, Jest upload and monitoring repair. A platform's folder identifies its code owner. This keeps shared-controller changes and their web/native callers in one reviewable source revision. Confirm the current branch is `main`, then commit and push completed units to `origin/main` as work progresses. Separate platform, deployment and worker branches are no longer maintained.

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

Shared domain logic stays in `packages/core`, `packages/solo` and `packages/hosted`. Shared browser presentation, Playable rendering, content support and build infrastructure stay in `packages/web-game`. That package retains the name `@riddle-quest/portal` for existing commands; it is the shared game package. Shared authoritative gameplay, account/economy rules and Firebase infrastructure stay in `firebase-functions/src`. Decide ownership by behavior rather than an old provider-prefixed filename.

## Build and archive contracts

Root `pnpm build:<target>` and `pnpm release:<target>` commands retain their provider-specific behavior. Vite selects one provider HTML root and one SDK integration at compile time. Local development serves the selected target at `/`. Each successful build audits resolved source ownership and runtime packages before accepting the artifact. Web artifacts exclude native modules and foreign provider SDKs. Outputs remain under `builds/<target>`; release receipts and exact-byte evidence retain the paths reported by their release command.

Android remains one native workspace. Its Gradle project, signing configuration and device helpers move together; shared imports resolve to the canonical shared packages. Machine-local configuration and upload keys remain ignored and private. Changes to native directory depth require updating Metro, TypeScript, test aliases and device/emulator repository-root calculations together.

Firebase still deploys only `firebase-functions`, with Node 22, its existing regions and zero reserved warm instances. Every Functions build explicitly prepares its shared dependencies, recreates the ignored `.build-source` tree inside that directory, clears old compiled output and audits the resulting deployment archive. The Firebase predeploy hook runs that same build command. Preparation rebuilds core from clean generated output and replaces its vendored deployment copy. It copies canonical shared and platform server sources into repository-shaped paths, preserving CommonJS package boundaries, then compiles an archive-local `lib` tree. The Functions entry is `lib/firebase-functions/src/index.js`. Generated source copies and compiled output are build artifacts; canonical provider source exists only in its platform folder. Maintenance scripts, test discovery, coverage paths, export/capacity audits and cycle checks must follow the same source roots.

Jest release preparation retains its clean-source snapshot, Bubblewrap isolation, credential permissions, token-on-stdin boundary, source/artifact hashes and upload receipts. Uploads run from `main`. Processing completion must be observed before reporting an upload complete. Activation requires explicit authorization; publication and review submission remain separate. Jest end-to-end checks use hosted unpublished previews when testing is requested.

## Verification and history

Run tests and browser harnesses only when explicitly requested. Build the artifacts needed for a change or upload, and use the static platform-layout and dependency guards to check source placement. GitHub Actions remains manual-only behind its runner-usage confirmation gate; ordinary commits and pushes do not authorize hosted runs.

Active operational documents use current paths. Dated evidence, research and historical ADRs retain the paths and revisions that were actually observed. For those older records, `packages/portal` describes the former web package, `packages/android` the former native root, and `packages/reddit-app` the former Devvit root. Use this document to find their current owners rather than rewriting historical results.

The Sentry background worker remains in `tooling/sentry-worker`. Its automated repair policy covers shared source plus Jest/Facebook source, server code and scripts. Native and other provider roots remain outside that policy. Repair PRs target `main`. Signed main-base checks, deployed-version verification, exact-head merge checks and deployment authority remain required. See [the worker runbook](sentry-worker.md).
