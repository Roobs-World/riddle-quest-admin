# Platform release commands

Riddle Quest has one canonical release command for each shipping target. Run all commands from the repository root.

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
| `pnpm release:jest` | Clean committed snapshot, full extended production verification, isolated build, exact-byte browser checks, receipt barriers | Uploads one Jest build with automatic activation | Version ID, ZIP hash, and accepted-pending receipts; authoritative completion and active-version verification remain required |
| `pnpm release:facebook` | Clean-source Facebook build and artifact audits, root-content ZIP, source/hash receipt, read-only hash-named archive, hash-scoped retry barrier | None | Printed immutable archive path for manual upload as a non-production Meta Draft |
| `pnpm release:youtube` | Content audit, all isolated target builds and browser gates, deterministic package and evidence | None | `build-youtube.zip`, manifest, and test report for manual Portal ingestion and certification |
| `pnpm release:reddit` | Contract validation, fresh isolated Devvit package build, commit/hash-bound receipt and read-only candidate handoff | None | Immutable package under `packages/reddit-app/.reddit-release-receipts`; remote ingestion remains blocked pending exact-byte proof |

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
          +--> Jest adapter ----> packages/portal/scripts/release-jest-timestamped.mjs
          +--> Facebook adapter -> Facebook preflight + facebook:draft begin
          +--> YouTube adapter -> packages/portal/scripts/youtube-release-artifact*.mjs
          `--> Reddit adapter --> packages/reddit-app/scripts/prepare-reddit-release.mjs
```

The release module owns discovery, operator-visible effects, dry runs, dispatch, and failure propagation. It does not read credentials or flatten the four provider protocols. Target-native modules retain their locks, fingerprints, artifact audits, receipts, and external uncertainty rules.

Runtime code remains compile-time isolated:

- `packages/portal/src/jest` contains Jest integration code and builds to `packages/portal/dist-jest`.
- `packages/portal/src/facebook` contains Facebook integration code and builds to `packages/portal/dist-facebook`.
- `packages/portal/src/youtube` contains the self-contained YouTube adapter and builds to `packages/portal/dist-youtube`.
- `packages/portal/src/reddit` contains the same-origin webview adapter; `packages/reddit-app/src/server` contains the trusted Devvit Gateway. Together they build the Reddit App package.

Build one target without starting a release:

```bash
pnpm build:jest
pnpm build:facebook
pnpm build:youtube
pnpm build:reddit
```

## Provider-specific safeguards

### Jest

`release:jest` delegates intact to the timestamped release module. It refuses a dirty tree, preserves Bubblewrap and credential isolation, binds automatic activation to the exact gated artifact, and leaves accepted-pending or ambiguous barriers in place. Jest activates that exact version only after processing succeeds. The command does not make a private game public or submit it for review.

### Facebook

`release:facebook` runs the existing Facebook upload preflight, then `facebook:draft begin`. It performs no Meta request. The preflight rebuilds/audits the target, runs the source secret-boundary audit, re-audits before packaging, and writes a ZIP receipt that records source cleanliness. `begin` refuses dirty source, copies clean verified bytes to an owner-private, read-only, hash-named archive, and opens that hash's retry barrier. Upload only the printed archive path as a non-production Draft. Acceptance and production promotion remain explicit human actions recorded through the target-native evidence commands.

The barrier is exclusive only within one archive hash. Before beginning, operators must inspect all retained Facebook barriers and refuse a new hash while any older attempt is `transmitting` or `ambiguous`. Do not rerun preflight or change `HEAD` until the active handoff is accepted and, when applicable, promoted: outcome commands currently resolve the singleton gated ZIP/receipt, not an arbitrary older snapshot. If `begin` is interrupted after creating its archive but before its barrier, stop for manual investigation instead of rerunning or uploading.

### YouTube

`release:youtube` creates a deterministic local handoff. It never opens, scrapes, or submits the YouTube Developer Portal. Hosted Test Suite, device, metadata, and certification evidence remain human-owned and hash-bound.

### Reddit

`release:reddit` stops before remote mutation. The installed Devvit `upload` command runs a build, while `devvit publish` creates and uploads a new version. Neither command currently proves that the immutable candidate handoff is the version being ingested or promoted. For that reason, the package-level `release:upload` and `release:publish` shortcuts fail closed. The setup wizard's explicitly named `playtest:upload` is a non-promotable bootstrap build, not release evidence.

Remote Reddit release is blocked until an exact-byte Devvit adapter or equivalent authoritative proof is available. After such a path ingests and reviews one retained candidate, `pnpm --filter @qwordly/reddit-app release:promotion` verifies that hosted evidence matches its receipt, commit, SHA-256, and read-only handoff before the human promotes that existing version. Never rebuild between evidence and promotion.

The legacy `pnpm jest:build-upload` and `pnpm youtube:preflight` aliases remain for one migration cycle and delegate to the canonical commands. `pnpm facebook:preflight` remains a lower-level local check and does not create the immutable handoff; use `pnpm release:facebook` for that boundary.
