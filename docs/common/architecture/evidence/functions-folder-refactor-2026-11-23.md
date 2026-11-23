# Functions folder refactor verification

Recorded for the [Functions source layout](../functions-source-layout.md), starting from commit `7eacbe3ee`. The preceding feature-source refactor was already committed and pushed before this work began.

## Scope

Production race and gameplay files were grouped by responsibility. Production tooling moved into build, deploy, runtime, content, race-maintenance, maintenance and verification folders. Testing configuration moved into `config/testing`; test suites and their source fixtures remain in their original locations. Facebook presence/push implementations and the Android account assertion moved to their provider folders.

The layout guard enforces at most 20 direct non-test files in each project-owned Functions folder. Test files, test folders, installed dependencies and generated output are exempt. It is part of the build, type-check and lint commands and can be run directly with `pnpm check:functions-layout`.

## Results

- The directory audit checked 43 folders. The largest has 17 direct non-test files.
- The Functions entry retains exactly the same 95 exported names. Its runtime remains Node 22 with CommonJS emission and entry `lib/firebase-functions/src/index.js`.
- Clean source staging, compilation, cycle checking, deployment archive auditing and capacity auditing passed. The cycle graph contains 257 modules and 1,345 runtime references. The archive audit inspected 257 modules, 1,343 runtime references and 516 upload files. Testing configuration is excluded from that archive.
- Root type checks passed for shared source, Android, Functions and Reddit.
- Eight relocated Jest configurations retain their effective Functions root, suite-selection patterns and mapped numeric coverage thresholds. The race coverage scope follows the extracted provider helpers. Configuration parsing did not execute tests.
- All 696 checked relative test imports, mocks and requires resolve. Test locations, assertions and suite membership were preserved.
- The source review accounted for all 137 backend production files and found no unexpected lost declarations. The four extracted declarations retain their original AST text.
- Platform layout, modern package features, security, manual CI controls, monetization, suite registration, source size and TSDoc static audits passed.
- Final review corrected 114 stale references in 111 browser-tooling files to the existing retained-race fixture at `scripts/web/fixtures/RetainedRaceHarness.tsx`. These are exact path substitutions from the preceding source reorganisation; no harness was run.

No tests or browser harnesses were run. No game upload or backend deployment was performed.
