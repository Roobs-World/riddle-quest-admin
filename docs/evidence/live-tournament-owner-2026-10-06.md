# Active tournament board ownership and read admission — 6 October 2026

The active tournament board now removes old standings, share controls and feedback before a provider or read operation replacement commits. Each provider/read/locale/native-entry-locale lifetime owns a separate panel. Pending old native share failures cannot appear on the replacement panel; old successes cannot clear its current error or start an unsolicited retry. An explicit retry still admits one additional authority read. Ordinary updates and abandoned prepared replacements retain the original board, rows and native action behavior.

Deferred tournament reads now check their effect lifetime before calling the captured original method with its original provider receiver. Cancelled reads do not reach the provider, and retired responses are not parsed into presentation. The development StrictMode reproduction previously issued two authority reads for one mounted board; the candidate issues one. This is an observed request-count improvement in development; no production network latency reduction is claimed.

## Reproduction and diagnosis

Evidence: `artifacts/live-tournament-owner-2026-10-06/`. The harness drives the actual `RaceTournamentEntry` and Tournaments destination using real Vite/React, native controls and schema-valid standings. The inactive recorded-race presentation is not used.

Three minimized cases cover initial mounting, provider replacement with a held new read, and provider replacement while an original native share is pending. Original development source fails 8 of 16 assertions: three duplicate-read checks, four stale standings/control checks and one late native failure check. Original production source fails the five ownership checks; it does not duplicate the initial read.

The ranked explanations were unguarded deferred admission, board state retained across providers, and native response ownership guarded only by mount lifetime. Adding the read guard alone removes the three development duplicate-read failures, leaving the same five ownership failures as production. Keying the inner panel to immutable provider/read/locale ownership removes the stale projection and native feedback failures. A layout effect retires native callbacks as soon as the old panel unmounts. Existing schema validation, read deadlines, adapter dialog guards and server authority are preserved.

Final original-source replay fails 8 of 16 checks in development and 5 of 16 in production. Final candidate replay passes all 16 in both modes. The expanded preflight passes all 12 cases and 156 checks without fixture repairs.

## Frozen verification

- New maintained regression: 144 cases, 1,872 assertions and 144 screenshots across Chromium 153 and native Firefox 153, development and production React, and three viewports. Twelve scenarios cover initial admission, provider replacement, in-place read replacement, held old reads, old authority failure, native failure/success settlement, explicit retry, profile updates, 16 stable updates, abandoned replacement, game locale and native entry locale.
- Adjacent navigation focus regression: 72 cases and 1,044 assertions in development and production Chromium pass, including later native Tab and Enter actions.
- Adjacent capability regression: 72 cases and 960 assertions in development and production Chromium pass, retaining fallback, chooser feedback, capability restoration, abandonment and Home/End behavior.
- Adjacent active rematch regression: 54 cases and 852 assertions in development and production Chromium pass, including provider/operation retirement and fresh playable rematches.
- Final candidate minimized replays: six cases and 32 assertions pass. Across these final browser regressions, 348 cases and 4,760 assertions pass. The new and capability/rematch harnesses record no external provider traffic, browser exceptions or unhandled rejections.
- Portal units: 2,898 pass, 93 skipped. Built Jest/Reddit browser tests: 22 pass; the Facebook artifact fixture adds one passing test.
- All six isolated target builds and the Devvit server build pass. YouTube uses the fixture command; this is not release certification.
- Type, boundary, security, TSDoc and file-size audits pass: 26,590 documented declarations and 1,265 source files.

The frozen candidate contains 2,454 selected source inputs. Identical after-build, runtime-terminal and terminal manifests prove no selected source changed during final verification. The prior verified 2,453-input state is the baseline. Three owned source records reproduce the exact patch: the active entry, package-script registration, and the maintained browser regression. Reverse patch validation passes against the current checkout; earlier dirty work is retained.

Authority evidence is reused by byte hash. All 824 selected authority inputs and 24 canonical/installed compiled core copies remain unchanged. The prior logs prove 391 core, 1,730 backend, 677 SDK integration and 17 Node 22 SDK tests. They are reused results, not fresh runs or a claim that every registered SDK suite was executed.

No production copy, translations, scoring, purchase grants, account exchange, economy or backend API changes. The changed entry is included only in Facebook and Reddit among the six target dependency inventories. Boundary audits and retained inventories verify the target provider restrictions.

## Evidence preservation

All 19 tracked final jobs are terminal. The two deliberately failing original-source replay jobs exit 1; the other 17 exit 0. All 1,301 built files are preserved under `built/` with SHA-256 verification. Six target inventories and one Facebook browser-fixture inventory are copied and hashed before their exact owned originals are removed. The exact owned temporary build root and browser scratch directories are removed after jobs finish and preservation succeeds. No commit, push or deployment was performed.

Revalidate from the repository root:

```sh
python3 artifacts/live-tournament-owner-2026-10-06/verify.py
```

The wider improvement goal remains active. Other native-dialog capability lifetimes and the Activity context board remain candidates for separate reproduction. The earlier live-retirement backend protocol still requires backend/Devvit deployment before releasing those previously changed clients; this pass does not deploy.
