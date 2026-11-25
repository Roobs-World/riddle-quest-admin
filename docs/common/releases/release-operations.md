# Platform release commands

Riddle Quest has one canonical release command for each shipping target. Run all commands from the repository root in a clean, committed `main` checkout. Push the reviewed source to `origin/main` before preparing an upload or handoff. Monitoring repairs also target `main`; separate platform and worker branches are no longer maintained.

```bash
pnpm release:jest
pnpm release:facebook
pnpm release:youtube
pnpm release:reddit
```

The commands deliberately share names, not lifecycle semantics. Jest supports a hardened API upload, Facebook and YouTube produce manual Dashboard or Developer Portal handoffs, and the current Devvit CLI cannot prove that a gated archive is promoted without rebuilding it.

Use the read-only plan before choosing a target:

```bash
pnpm release:plan
pnpm release:jest --dry-run
pnpm release:facebook --dry-run
pnpm release:youtube --dry-run
pnpm release:reddit --dry-run
```

## Command boundaries

| Command | Repository work | External effect | Successful handoff |
| --- | --- | --- | --- |
| `pnpm release:jest` | Clean committed snapshot, security/type/build checks, isolated build, exact-byte artifact and HTML audits, receipt barriers | Uploads and activates one Jest build without game publication | Version ID, ZIP hash, and accepted-pending receipts; authoritative processing/activation and exact-version testing remain required |
| `pnpm release:facebook` | Clean-source Facebook build and artifact audits, root-content ZIP, source/hash receipt, read-only hash-named archive, hash-scoped retry barrier | None | Printed immutable archive path for manual upload as a non-production Meta Draft |
| `pnpm release:youtube` | Content audit, isolated production builds and artifact audits, deterministic package and evidence | None | `platforms/web/youtube/build/build-youtube.zip`, manifest and build/audit report for manual Portal ingestion and certification |
| `pnpm release:reddit` | Contract validation, fresh isolated Devvit package build, commit/hash-bound receipt and read-only candidate handoff | None | Immutable package under `platforms/web/reddit/build/.reddit-release-receipts`; remote ingestion remains blocked pending exact-byte proof |

`pnpm release:all` runs the shared target verification gate before invoking the Jest, Facebook, YouTube, Reddit, Netflix, Yahoo, itch.io, CrazyGames, and Newgrounds adapters in order. Use `pnpm release:all --dry-run` to inspect every external effect without building, uploading, packaging, or publishing. Each adapter retains its provider-specific delivery boundary.

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
          +--> Facebook adapter -> Facebook preflight + facebook:draft begin
          +--> YouTube adapter -> platforms/web/youtube/scripts/youtube-release-artifact*.mjs
          `--> Reddit adapter --> platforms/web/reddit/scripts/prepare-reddit-release.mjs
```

The release module owns discovery, operator-visible effects, dry runs, dispatch, and failure propagation. It does not read credentials or flatten the four provider protocols. Target-native modules retain their locks, fingerprints, artifact audits, receipts, and external uncertainty rules.

The production verification gate builds and audits Facebook through `build:web` and runs its source-secret audit separately. Facebook ZIP creation and handoff preparation belong to the explicit `preflight:facebook-upload` command, which retains its pending-upload barrier checks. Jest verification prepares and verifies its own archive while an existing Facebook handoff remains preserved.

Runtime code remains compile-time isolated:

- `platforms/web/jest/src` contains Jest integration code and builds to `platforms/web/jest/build/dist`.
- `platforms/web/facebook/src` contains Facebook integration code and builds to `platforms/web/facebook/build/dist`.
- `platforms/web/youtube/src` contains the self-contained YouTube adapter and builds to `platforms/web/youtube/build/dist`.
- `platforms/web/reddit/src` contains the same-origin webview adapter; `platforms/web/reddit/src/server` contains the trusted Devvit Gateway. Together they build the Reddit App package.

Build one target without starting a release:

```bash
pnpm build:jest
pnpm build:facebook
pnpm build:youtube
pnpm build:reddit
```

## Provider-specific safeguards

### Jest

`release:jest` delegates intact to the timestamped release module. It refuses a dirty tree, preserves Bubblewrap and credential isolation, binds build activation intent to the exact gated artifact, and leaves accepted-pending or ambiguous barriers in place. Processing activates that exact version. `JEST_RELEASE_INACTIVE=true` retains an inactive build. The command does not make a private game public or submit it for review.

`release:jest` runs security, type, locale, build, artifact and W3C checks without local unit suites, emulators or browser harnesses. No test-skipping flag is needed. Manual acceptance of the exact uploaded private version remains separate from those build results.

### Facebook

`release:facebook` runs the existing Facebook upload preflight, then `facebook:draft begin`. It performs no Meta request. The preflight rebuilds/audits the target, runs the source secret-boundary audit, re-audits before packaging, and writes a ZIP receipt that records source cleanliness. `begin` refuses dirty source, copies clean verified bytes to an owner-private, read-only, hash-named archive, and opens that hash's retry barrier. Upload only the printed archive path as a non-production Draft. Acceptance and production promotion remain explicit human actions recorded through the target-native evidence commands.

The barrier is exclusive only within one archive hash. Before beginning, operators must inspect all retained Facebook barriers and refuse a new hash while any older attempt is `transmitting` or `ambiguous`. Do not rerun preflight or change `HEAD` until the active handoff is accepted and, when applicable, promoted: outcome commands currently resolve the singleton gated ZIP/receipt, not an arbitrary older snapshot. If `begin` is interrupted after creating its archive but before its barrier, stop for manual investigation instead of rerunning or uploading.

### YouTube

`release:youtube` creates a deterministic artifact handoff from build and audit evidence. It never opens, scrapes, or submits the YouTube Developer Portal. Hosted Test Suite, device, metadata, and certification evidence remain human-owned and hash-bound.

### Reddit

`release:reddit` stops before remote mutation. The installed Devvit `upload` command runs a build, while `devvit publish` creates and uploads a new version. Neither command currently proves that the immutable candidate handoff is the version being ingested or promoted. For that reason, the package-level `release:upload` and `release:publish` shortcuts fail closed. The setup wizard's explicitly named `playtest:upload` is a non-promotable bootstrap build, not release evidence.

Remote Reddit release is blocked until an exact-byte Devvit adapter or equivalent authoritative proof is available. After such a path ingests and reviews one retained candidate, `pnpm --filter @riddle-quest/reddit-app release:promotion` verifies that hosted evidence matches its receipt, commit, SHA-256, and read-only handoff before the human promotes that existing version. Never rebuild between evidence and promotion.

The legacy `pnpm jest:build-upload` and `pnpm youtube:preflight` aliases remain for one migration cycle and delegate to the canonical commands. `pnpm facebook:preflight` remains a lower-level build and artifact check and does not create the immutable handoff; use `pnpm release:facebook` for that boundary.

Current authorization: Jest build activation and Firebase Functions deployment are allowed. Jest game publication, review submission and listing visibility changes remain held. Build activation and game publication are separate actions.
