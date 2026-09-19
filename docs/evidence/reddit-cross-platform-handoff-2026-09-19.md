# Reddit integration and cross-platform handoff — 2026-09-19

The combined workspace changes include Reddit packaging, Gold checkout browser
coverage, explicit-version private uploads, and Facebook's hosted-validator and
onboarding fixes. Root tests and typechecks include the Devvit package. CI builds
the Reddit client before staging it in the browser job.

The final verification found and fixed one additional regression: the Facebook
compile-time guard in `GameFrameApp` introduced `import.meta` into the CommonJS
unit runner. The guard now lives in a small environment module with a Node test
mock, following the existing Firebase environment pattern. The existing rendering
test failed before the fix and passes afterward. The Facebook artifact audit
confirms its unsupported iframe fallback is still removed.

## Verification

- All four isolated artifacts built and passed their audits. YouTube used the
  explicitly non-release engineering content fixture.
- Final browser tests: Jest gameplay/accessibility and 28 authentication cases;
  Facebook onboarding/gameplay; Reddit guest/authenticated play and Gold checkout;
  all nine YouTube cases passed.
- Complete Devvit package validation passed, including 31 tests.
- Unit coverage gates passed: core 108 tests, portal 749 tests, backend 992 tests.
  The portal's 42 opt-in cases are excluded from the ordinary unit command;
  browser suites were run separately as listed above.
- Firebase emulator integration and rules: all 21 suites / 54 tests passed.
- Firebase verification under Node 22.23.1 passed TypeScript, ESLint, and unit tests.
- Root typechecks, backend lint, source documentation/size checks, Reddit setup
  and documentation audits, platform boundaries, Facebook commerce/profile/copy
  checks, backend scalability, and E2E reachability checks passed.
- Artifact/release regression suite passed all 126 tests.

## Hosted completion remains separate

The game Terms URL, https://roobsworld.com/riddle-quest/terms, now returns HTTP 200
and is linked in the Reddit package README. No Reddit app-setting update, new
upload, production deployment, or publication was performed in this handoff.

Reddit's contract gate still reports missing auth, payment, refund, post-entry,
realtime, and notification hosted fixtures. Its hosted evidence gate still reports
`reddit-hosted-evidence-missing`. Owner browser authentication, policy configuration,
provider approvals, physical-device/multiple-role evidence, and immutable artifact
promotion remain outstanding. These checks were not bypassed or marked complete.

Facebook's unverified commerce path remains disabled; its build and gameplay
checks passing do not establish payment activation or publication approval.
Local environment secrets and generated deployment artifacts remain ignored.
