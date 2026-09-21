# Standalone web and PWA deployments

Two direct hosting targets complement the partner distribution packages:

| Command | Production destination | Behavior |
| --- | --- | --- |
| `pnpm deploy:web` | https://riddle-quest-web.vercel.app/ | Self-contained browser game with local progress |
| `pnpm deploy:pwa` | https://riddle-quest-pwa.vercel.app/ | Installable browser game with local progress and offline reload |

These are independent Vercel projects under the existing authenticated account. They reuse the audited provider-neutral solo artifact; they do not represent Netflix, Yahoo, Microsoft Store or another partner's publication. Identity, payments, ads and external provider SDKs remain absent.

Each command builds the release, stages only static output in a temporary directory, tests actual gameplay and save/reload in Chromium, and deploys those tested bytes with Vercel's [Build Output API](https://vercel.com/docs/build-output-api). It then checks every remote file against the staged artifact and repeats the browser flow against the public production alias. PWA verification also checks Chromium installability and reloads with networking disabled. The project scope comes from the existing `.vercel/project.json`; the existing Yahoo project link is not changed.

Use `--prepare-only` to stop after local verification. If a deployment succeeds but a later check fails, inspect that deployment and reconcile it without uploading again:

```sh
pnpm deploy:web --verify-existing https://YOUR-EXISTING-DEPLOYMENT.vercel.app
pnpm deploy:pwa --verify-existing https://YOUR-EXISTING-DEPLOYMENT.vercel.app
```

The recheck rebuilds the local candidate and requires exact equality with the existing remote files. A changed candidate fails; it never promotes different bytes. Reports are written to `artifacts/release-e2e/deploy-web.json` and `deploy-pwa.json`. Temporary staging retains the CLI deployment response for reconciliation.

## End-to-end testing

```sh
pnpm verify:all-targets
pnpm test:release-targets:e2e
pnpm test:deployments:live
```

- `verify:all-targets` builds the isolated provider artifacts and runs the Jest, Facebook, Reddit and YouTube injected browser suites and supporting validation.
- `test:release-targets:e2e` validates all 55 tracked release records and artifact digests, then opens each of the 46 neutral/GameSnacks/PWA ZIPs plus the Netflix and Yahoo directories in a fresh phone-sized browser context. Each flow solves ROME through the UI, verifies 300 → 450 coins, reloads and verifies Classic 2/180. GameSnacks additionally checks SDK load/readiness/save and pause/resume. External resource requests and failed assets fail the checks. Its SDK is injected only by the harness.
- `test:deployments:live` repeats gameplay and persistence against the web, PWA and Yahoo production sites. PWA also must pass installability and offline reload. These local-progress tests do not use an account or purchase anything.

The release workflow runs the packaged browser checks and retains their JSON report. These checks establish local artifact behavior, not third-party listing approval or a real provider's SDK certification. Jest's account-backed live test remains `test:jest-deployed:playwright`; use a private authenticated state file, exact active build version and the existing test-only App Check credential as documented in `jest-html5-operations.md`.

## Offline correction

The previous PWA worker registered successfully but never populated its cache. A real offline browser reload reproduced `net::ERR_FAILED`. The new worker precaches every bundled game file before activation, versions its cache using content hashes, removes only obsolete caches belonging to this app and serves same-origin GET requests from that verified cache. Progress remains in local storage. The offline test now passes both locally and on the deployed PWA.
