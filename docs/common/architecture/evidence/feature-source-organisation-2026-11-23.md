# Feature source organisation verification

Recorded 23 November 2026 for the continuation of the [shared source refactor](../shared-source-layout.md), starting from commit `8f7b54444`.

## Scope

The source review mapped all 700 files in the former `src/core`, `src/solo`, `src/hosted` and `src/web` trees before moving them. Feature ownership replaced those layer folders. Forty-three cross-feature aggregate entry points and pure re-export files were removed, and callers now import their canonical implementations. Narrow feature APIs remain for race contracts, pricing and shared local-game hooks.

Race helpers were further grouped by matchmaking, history, presentation, rounds, drafts and recovery. Gameplay session state was split into checkpoint, journal and completion groups. The largest final directory contains 12 direct production TypeScript/CSS files, compared with 59 direct files in the former `src/web/play` directory. This count excludes tests, fixtures and translation catalogs.

## Verification

- All seven web targets built and passed their artifact audits. Exact dependency inventories match the emitted files, and the Jest initial-transfer budget is unchanged.
- The staged Reddit client and bundled Devvit server passed their package contract audit.
- Native TypeScript analysed 103 root files and 913 total files with zero diagnostics. Metro produced an Android release JavaScript bundle and one asset. No APK or Android App Bundle was built.
- The shared TypeScript compiler API analysed 433 root files and 2,018 total files with zero diagnostics. The root type-check command also passed for shared, native, server and Reddit sources.
- Functions compiled the reachable server graph and passed its cycle, archive and capacity audits. The archive audit inspected 254 modules, 1,331 runtime references and 510 upload files. Its source-content ignore rule now preserves emitted `lib/src/content` code.
- Platform ownership, import boundaries, locale consistency, security, manual CI gates, monetization, source size, TSDoc and suite-registration audits passed.
- Configuration parsing confirmed all four shared verification groups and both race profiles without warnings. Static discovery covers 392 eligible source test files with no duplicates or omissions. Original coverage floors remain effective.
- A declaration comparison reviewed 324 moved production files without finding a lost declaration or missing destination.

An existing analytics detector mistook a random asset filename for a measurement ID. The artifact guard now recognises quoted measurement IDs and analytics domains, while allowing ordinary asset hashes. The actual Jest artifact passes the guard.

Tests and browser harnesses were not run, following the repository instruction. Build, configuration and static checks do not replace runtime regression suites.
