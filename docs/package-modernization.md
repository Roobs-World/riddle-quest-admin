# Package modernization

Last reviewed: 2026-11-22.

Direct dependencies, security overrides, the standalone worker and native SDK pins were reviewed against current stable releases. Compatibility and release-age constraints are recorded below. The workspace and CI use pnpm 12.21.0.

## Adopted capabilities

- React 19.3.1 with stable React Compiler 1.0 through the official `@vitejs/plugin-react` v6 preset. Android's Metro and Jest resolvers select its own React and Firebase instances when loading shared code.
- Vite 8.3.8 and Rolldown 1.2.19, native TypeScript path resolution, DevTools, and browser error forwarding during development.
- OpenAI SDK 7.62 with Responses API structured outputs, prompt-cache routing, and `store: false` for stateless riddle generation and review.
- Jest 30.5.2 with its environment, timers, globals and mock overrides aligned to the same release. Existing coverage thresholds remain in force.
- Zod 4's current `.check()` refinement API instead of deprecated `.superRefine()` usage.
- Firebase 13.4 for browser/native clients, Firestore Lite for client reads, second-generation callable functions and App Check. Functions retains its verified Node 22 production runtime and compatible Firebase dependencies.
- Sentry 11.16 with explicit PII disabling, encrypted DSN validation and application-specific telemetry redaction.
- TypeScript 6 strict checking with explicit environment types and options that prepare the project for the native TypeScript 7 compiler.

## Compatibility constraints

| Dependency family | Selected versions | Constraint |
| --- | --- | --- |
| Portal compiler | Babel 8.1.3 | Vite and its React Compiler pipeline use Babel 8. |
| Jest and Android Babel | Core 7.29.13; current Babel 7 native plugins | Jest's current-node-syntax preset and React Native's transformer still load Babel 7-only plugins. A scoped `babel-jest` package extension supplies its private Babel 7 dependency, preserving transformation and mock hoisting alongside Portal's Babel 8. |
| Functions Firebase | `firebase` 12.19.0; app 0.16.2; app-compat 0.5.18; rules testing 5.0.2 | New Firebase 13 components require Node >=24.12.0. The production backend remains Node 22. Only firebase-admin's database-compat child is pinned to the compatible 2.1.7; client Firebase 13 keeps its own newer children. |
| TypeScript tooling | Transformer API 6.0.2; compiler alias 7.0.2; typescript-eslint 8.72.2 | The transformer uses the classic TypeScript API. typescript-eslint 8.73 adds an optional native peer requiring a TypeScript 7.1 nightly, so the latest compatible stable parser/plugin family remains 8.72.2. |
| React Native | 0.88.1 with CLI 20.2.0 and its matching Hermes compiler | The official CLI compatibility table pairs CLI 21 with React Native 0.89. Gradle, AGP and Kotlin remain matched to React Native. |
| Android Google ID | 1.2.0 | Version 1.2.1 failed the real release compile because its Kotlin 2.4 metadata is incompatible with the current Kotlin 2.2 compiler. FCM updates to 26.0.2. |
| Legacy gRPC web transport | Private google-protobuf 3.21.4 | The legacy gRPC package requires 3.x. Devvit keeps its separate current 4.x dependency. |
| Hono | 4.13.19 | Version 4.13.20 was published inside pnpm's default 24-hour release-age window at review time. No release-age exception is retained. |

The [Firebase Functions runtime guide](https://firebase.google.com/docs/functions/manage-functions#set_nodejs_version), [React Native CLI compatibility table](https://github.com/react-native-community/cli#compatibility), [typescript-eslint native-backend documentation](https://typescript-eslint.io/packages/parser/#experimental-typescript-7-native-backend), and [pnpm dependency-resolution settings](https://pnpm.io/settings#minimumreleaseage) explain the relevant provider/tooling constraints. Exact package engines and dependency ranges were also checked in published npm metadata.

Devvit CLI 0.15.4 uses `image-size` 2.0.4, whose upstream HEIF, ICNS and JXL parsers reject the malformed inputs covered by the former local backport. The backport and the GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr audit exceptions have been removed together. `scripts/image-size-security-patch.test.mjs` resolves the parser actually installed under Devvit, requires version 2.0.4 or newer, and retains timeout-bounded malformed-input probes.

The remaining braces 3.0.3 backport and its advisory exception stay paired with their existing regression check. Transitive security overrides use the newest releases within each consumer's compatible major family.

The standalone Sentry worker uses Sandbox 4.1.0 and Codex 0.171.0. Its narrow OIDC 4.0.9 override removes the audited vulnerable transitive chain. Worker tests and the actual downloaded Codex binary's supported flags were checked.

The immutable Jest release takes a consistent SQLite backup of pnpm's package index, including committed WAL pages, into its private license store. The operator's store stays read-only. License generation accepts both pnpm's native executable and its JavaScript entrypoint.

Jest resolves its locale loader to an English-only module before bundling, so unused translations no longer enter its archive. Other targets retain their catalogs. Its build also removes the unused Analytics script URL and Crashlytics version entry from Firebase's shared app metadata. Tests compare every remaining script URL and product mapping with the installed SDK, exercise its actual URL validator, and reject unexpected source changes. Artifact security and size limits remain unchanged.

The audit has no production findings. Three moderate development-only advisories remain in the upstream Firebase/Jest tooling chains for OpenTelemetry, glob and minimatch. Their fixes require major-version changes to those transitive APIs; this update retains the versions selected by their current consumers.

## Deliberate non-adoptions

- React `Activity` and `useEffectEvent` are semantic APIs, not global optimizations. They should be introduced only where a specific UI lifecycle requires them.
- Sentry log forwarding remains disabled because Firebase logging is already authoritative; duplicating every log would add telemetry volume and cost.
- The backend deployment runtime remains Node 22; local tooling uses Node 24.

`pnpm check:modern-packages` prevents the adopted configuration from silently regressing. Run `pnpm outdated -r`, `pnpm peers check`, and `pnpm audit --prod` during each package review.
