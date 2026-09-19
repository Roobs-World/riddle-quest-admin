# Reddit integration and Jest isolation — 2026-09-19

Local engineering verification passed for the Reddit client and Devvit package.
This does not establish hosted Reddit connectivity or production approval.

## Integration changes

- Root `pnpm build:reddit` now builds and validates the complete Devvit package,
  including its typecheck, tests, and package contract.
- Root `pnpm check:types` and `pnpm test` now include the Devvit package.
- The production-readiness browser job now stages the Reddit package after
  `pnpm test:e2e` builds the client. Previously it tried to copy `dist-reddit`
  before that directory existed in the job's fresh checkout.

## Verification

| Check | Result |
| --- | --- |
| Four target builds and artifact audits | Passed; YouTube used the explicitly non-release engineering fixture |
| Jest artifact | 418 files, 4.15 MiB; no Devvit integration found |
| Reddit artifact | 435 files, two entry documents, 3.65 MiB; isolation audit passed |
| Complete Devvit package | 436 files, 7.04 MiB; package contract and 31 tests passed |
| Rebuild isolation | All 418 Jest file paths and SHA-256 hashes were identical before and after `pnpm build:reddit` |
| Root typechecks | Passed, including the Devvit server |
| Root tests | Core: 108 passed; portal: 738 passed, 42 opt-in tests skipped; Devvit: 31 passed |
| Reddit client unit tests | 33 passed |
| Reddit/Jest backend unit tests | 18 suites, 171 tests passed |
| Injected Reddit browser harness | Passed inline expansion, guest and authenticated play, locale checks, and same-origin requests |
| Injected Jest browser harnesses | Gameplay/accessibility test and all 28 authentication tests passed |
| Artifact and release regression tests | 123 passed |
| CI security and E2E reachability audits | Passed |

Builds and subprocess/browser checks required normal local execution outside the
restricted sandbox. No deployment, upload, feature approval, or secret change
was performed. Backend unit tests ran under local Node 24; this run did not
exercise the Node 22 production runtime or Firebase emulator integration suites.

## Remaining production gates

`validate:contracts` still fails because auth, payment, refund, post-entry,
realtime, and notification hosted fixtures are missing. `validate:hosted` still
fails with `reddit-hosted-evidence-missing`.

The prior [private-playtest evidence](reddit-release-2026-09-17.md) records further
outstanding policy, external-fetch/payment approval, device-testing, deployment,
and immutable release evidence. Those remote conditions were not reverified by
this local run. The production gates remain enforced; local harness results must
not be treated as live Reddit acceptance.
