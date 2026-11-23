# Shared source consolidation verification

Recorded 23 November 2026 for the migration described in [Shared source layout](../shared-source-layout.md).

## Scope

The four shared package source trees were analysed before moving their files into root `src/core`, `src/solo`, `src/hosted`, and `src/web`. Shared manifests and per-folder configuration were removed. Provider-only controllers, schemas, catalogs, build plugins, and their tests moved into the relevant platform folders.

## Build and static verification

- All seven web targets built successfully. Their artifact audits passed, including provider ownership and runtime dependency checks. The exact dependency inventories were checked against the emitted artifacts.
- Reddit's Devvit server built and its staged package contract passed.
- The Android production Metro bundle built successfully. The native TypeScript program had no diagnostics. This check did not build an APK or Android App Bundle.
- The Functions archive compiled and passed its deployment, capacity, and cycle audits. The archive contains the canonical shared source compiled alongside the provider server sources.
- The root TypeScript compiler API analysed 473 root files and 2,044 total source files with zero diagnostics. The root type-check command also passed for shared, native, server, and Reddit sources.
- Platform layout, web boundaries, locale consistency, security configuration, manual CI gates, monetization, source size, TSDoc, and browser/emulator suite-registration audits passed. Registration audits inspect configuration and do not execute suites.
- Jest configuration parsing confirmed the original core, web, and race coverage floors. The original core coverage floors also follow the provider catalogs and native entry schema to their new locations.
- A declaration review compared 378 moved production files to their originals. No unintended declarations were lost. A relative-import review found no unresolved production imports or self-imports.

The previous web Babel 8 compiler was retained after an isolated build comparison showed that changing it altered the initial artifact size. The existing Jest transfer budget remains unchanged.

Tests and browser harnesses were not run, following the repository instruction. This refactor has build and static verification; runtime regression suites remain unexecuted.
