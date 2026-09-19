# Reddit private playtest verification — 2026-09-17

Status: private prerelease uploaded and installed; production release incomplete.

## Uploaded version

- App: `riddle-quest`, owned by `u/RareAdvertising2367`.
- Source commit used for the game build: `ad58fe7d22942138d44eed868f7ad5b9c2268610`.
- Version: `0.0.1.21`; Reddit reports upload at `2026-09-17T12:57:11.632Z`
  and build at `2026-09-17T12:57:15.213Z`.
- Upload: `pnpm --filter @qwordly/reddit-app exec devvit upload --version 0.0.1.21`.
- Installation: `pnpm --filter @qwordly/reddit-app exec devvit install riddle_quest_dev riddle-quest@0.0.1.21`.
- Both commands succeeded; `devvit view riddle-quest@0.0.1.21 --json` and
  `devvit list installs riddle_quest_dev` independently confirmed the version.
- Test URL: https://www.reddit.com/r/riddle_quest_dev/?playtest=riddle-quest
- The existing `r/RiddleQuestGame` installation remains at `0.0.1.20`.

This is a bootstrap playtest, not an immutable production candidate or approval
receipt. The worktree contained unrelated untracked Jest simulator artifacts;
the immutable clean-worktree release gate was not bypassed. The upload helper,
wizard, and operations documentation were updated after this upload.

## Local verification

`pnpm preflight:all-platforms` passed with access to the existing pnpm store and
browser processes. The sandbox-only attempt could not open pnpm's store database.

| Check | Result |
| --- | --- |
| Jest artifact | 418 files, 4.15 MB; isolation audit passed |
| Facebook artifact | 420 files, 4.11 MB; isolation audit passed |
| Reddit artifact | 435 files, two entry documents, 3.65 MB; same-origin audit passed |
| YouTube artifact | Seven files, 0.28 MiB; isolation audit passed |
| Locale audit | 17 locales × 23 namespaces passed |
| Browser harnesses | Jest hosted 1, Jest authentication 28, Facebook 1, Reddit 1, YouTube 9 tests passed |
| YouTube unit tests | 43 passed |
| Release-script tests | 123 passed |
| Devvit package | 28 tests and typecheck passed; 436 files / 7.04 MiB validated |
| Reddit backend preflight | Typecheck, lint, export audit, 90 suites / 992 tests, and build passed |

The local backend preflight ran under Node 24.17.0 and emitted the expected engine
warning because Functions targets Node 22. The deployed Functions run Node 22.
The browser results use injected provider harnesses and do not substitute for
hosted Reddit or physical-device evidence.

## Live backend checks

Firebase reported these four Node.js 22 Functions as `ACTIVE`:

| Function | Revision |
| --- | --- |
| `exchangeRedditIdentity` | `exchangeredditidentity-00003-pan` |
| `deleteRedditAccount` | `deleteredditaccount-00003-kec` |
| `redditStorage` | `redditstorage-00003-deb` |
| `redditGameplay` | `redditgameplay-00003-xaz` |

All four rejected unsigned empty POST requests with HTTP 401. Their deployed
`REDDIT_APPROVED_FEATURES` value is empty and sandbox commerce is enabled. These
checks do not prove signed Devvit connectivity, current rules deployment, or
production payment approval. No backend deployment or secret change was made.

## Upload collision and repair

The initial `devvit upload --bump prerelease` returned “This AppVersion already
exists”. Inspection of the installed 0.14.1 CLI showed that it requests only stable
versions before calculating the bump. Reddit confirmed `0.0.1.21` did not exist
before the explicit-version upload, which then succeeded.

The private upload helper now requires a numeric prerelease version, validates
the package, and invokes `devvit upload --version`. It rejects stable/malformed
versions and extra arguments, and stops without retrying on an uncertain outcome.
The setup wizard passes the operator's explicit version to this helper.
After the repair, Reddit package validation passed all 31 tests, typechecking,
and the artifact contract. Wizard syntax/tests, the documentation audit, and
`git diff --check` also passed.

## Remaining release gates

1. The live app metadata has empty Terms and Conditions and Privacy Policy fields.
   The README already lists `https://roobsworld.com/privacy`; the owner-approved
   Terms URL remains missing. Configure the app details and retain review evidence.
   Direct HTTP checks confirmed `/privacy` and `/contact` return 200, while
   `/terms` and `/terms-and-conditions` return 404. The published Privacy page
   (updated April 25, 2026) describes website sign-in, security, consented analytics,
   and data-rights requests. It does not explicitly describe Reddit game identity,
   progression, purchases, or the Firebase authority; game coverage needs owner
   review. No replacement Terms or Privacy policy was invented or published.
2. Obtain and record HTTP-fetch/payment approvals. Disabled notifications must not
   be represented as approved; the existing contract gate still requires a real
   notification fixture and needs an explicit release-scope decision if that
   capability remains excluded.
3. Verify the new test post in an authenticated Reddit browser and capture signed
   identity, storage, and gameplay results. The automated browser has no owner web
   session: the app dashboard returned 403 and direct post/test-community navigation
   was blocked by Reddit. The older game post was visible in the community feed.
   A short runtime-log stream produced no application events; this is not a smoke-test pass.
4. Capture the six sanitized hosted contract fixtures. `validate:contracts` currently
   fails for missing auth, payment, refund, post-entry, realtime, and notification.
5. Complete the developer/moderator/regular/anonymous journeys on Reddit web and
   physical iOS and Android devices. `validate:hosted` currently reports
   `reddit-hosted-evidence-missing`.
6. Retain the complete Functions/rules deployment receipt and signed probes, then
   produce a clean-commit immutable candidate and establish exact-artifact ingestion
   proof before production transmission. Existing release guards remain in place.

Reddit's [launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide)
requires web/mobile and multiple-account testing before review. Its
[CLI reference](https://developers.reddit.com/docs/guides/tools/devvit_cli) states
that `publish` creates a new version and submits it for review; a private upload
is not publication or approval. No publish request was submitted in this session.
