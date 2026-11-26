# Platform release commands

Riddle Quest has one canonical release command for each shipping target. Run all commands from the repository root in a clean, committed `main` checkout. Push the reviewed source to `origin/main` before preparing an upload or handoff. Monitoring repairs also target `main`; separate platform and worker branches are no longer maintained.

```bash
pnpm release:jest
pnpm release:youtube
pnpm release:reddit
```

The commands retain their provider-specific lifecycles. Jest supports a hardened API upload, YouTube produces a manual Developer Portal handoff, and the current Devvit CLI cannot prove that a gated archive is promoted without rebuilding it. This branch retains Facebook's backend without a Facebook frontend release target.

Use the read-only plan before choosing a target:

```bash
pnpm release:plan
pnpm release:jest --dry-run
pnpm release:youtube --dry-run
pnpm release:reddit --dry-run
```

## Command boundaries

| Command | Repository work | External effect | Successful handoff |
| --- | --- | --- | --- |
| `pnpm release:jest` | Clean committed snapshot, security/type/build checks, isolated build, exact-byte artifact and HTML audits, receipt barriers | Uploads and activates one Jest build without game publication | Version ID, ZIP hash, and accepted-pending receipts; authoritative processing/activation and exact-version testing remain required |
| `pnpm release:youtube` | Content audit, isolated production builds and artifact audits, deterministic package and evidence | None | `platforms/web/youtube/build/build-youtube.zip`, manifest and build/audit report for manual Portal ingestion and certification |
| `pnpm release:reddit` | Contract validation, fresh isolated Devvit package build, commit/hash-bound receipt and read-only candidate handoff | None | Immutable package under `platforms/web/reddit/build/.reddit-release-receipts`; remote ingestion remains blocked pending exact-byte proof |

`pnpm release:all` runs the shared target verification gate before invoking the Jest, YouTube, Reddit, Netflix, Yahoo, itch.io, CrazyGames, and Newgrounds adapters in order. Use `pnpm release:all --dry-run` to inspect every external effect without building, uploading, packaging, or publishing. Each adapter retains its provider-specific delivery boundary.

## Code structure

```text
pnpm release:<target>
          |
          v
scripts/release/run-platform-release.mjs
          |
          v
scripts/release/platform-releases.mjs
          |
          +--> Jest adapter ----> platforms/web/jest/scripts/release-jest-timestamped.mjs
          +--> YouTube adapter -> platforms/web/youtube/scripts/youtube-release-artifact*.mjs
          `--> Reddit adapter --> platforms/web/reddit/scripts/prepare-reddit-release.mjs
```

The release module owns discovery, operator-visible effects, dry runs, dispatch, and failure propagation. It does not read credentials or flatten provider protocols. Target-native modules retain their locks, fingerprints, artifact audits, receipts, and external uncertainty rules.

The production verification gate builds Jest and Reddit through `build:web`. It retains Facebook server-secret checks independently of browser artifact verification.

Runtime code remains compile-time isolated:

- `platforms/web/jest/src` contains Jest integration code and builds to `platforms/web/jest/build/dist`.
- `platforms/web/facebook/server` retains the authoritative Facebook integration and has no browser build.
- `platforms/web/youtube/src` contains the self-contained YouTube adapter and builds to `platforms/web/youtube/build/dist`.
- `platforms/web/reddit/src` contains the same-origin webview adapter; `platforms/web/reddit/src/server` contains the trusted Devvit Gateway. Together they build the Reddit App package.

Build one target with its target-specific command:

```bash
pnpm build:jest
pnpm build:youtube
pnpm build:reddit
```

After completing a Jest game build, follow the [standing upload and activation authorization](../../jest/jest-html5-operations.md#build-and-upload). The build command itself stays independent so internal release builds cannot recursively upload. Other targets keep their explicit release boundaries.

## Provider-specific safeguards

### Jest

`release:jest` delegates intact to the timestamped release module. It refuses a dirty tree, preserves Bubblewrap and credential isolation, binds build activation intent to the exact gated artifact, and leaves accepted-pending or ambiguous barriers in place. Processing activates that exact version. `JEST_RELEASE_INACTIVE=true` retains an inactive build. The command does not make a private game public or submit it for review.

`release:jest` runs security, type, locale, build, artifact and W3C checks without local unit suites, emulators or browser harnesses. No test-skipping flag is needed. Manual acceptance of the exact uploaded private version remains separate from those build results.

### YouTube

`release:youtube` creates a deterministic artifact handoff from build and audit evidence. It never opens, scrapes, or submits the YouTube Developer Portal. Hosted Test Suite, device, metadata, and certification evidence remain human-owned and hash-bound.

### Reddit

`release:reddit` stops before remote mutation. The installed Devvit `upload` command runs a build, while `devvit publish` creates and uploads a new version. Neither command currently proves that the immutable candidate handoff is the version being ingested or promoted. For that reason, the package-level `release:upload` and `release:publish` shortcuts fail closed. The setup wizard's explicitly named `playtest:upload` is a non-promotable bootstrap build, not release evidence.

Remote Reddit release is blocked until an exact-byte Devvit adapter or equivalent authoritative proof is available. After such a path ingests and reviews one retained candidate, `pnpm --filter @riddle-quest/reddit-app release:promotion` verifies that hosted evidence matches its receipt, commit, SHA-256, and read-only handoff before the human promotes that existing version. Never rebuild between evidence and promotion.

The legacy `pnpm jest:build-upload` and `pnpm youtube:preflight` aliases remain for one migration cycle and delegate to the canonical commands.

Current authorization: Jest build activation and Firebase Functions deployment are allowed. Jest game publication, review submission and listing visibility changes remain held. Build activation and game publication are separate actions.
