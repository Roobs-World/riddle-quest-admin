# Instructions modal target build verification

All six requested target commands ran sequentially after the canonical Jest build completed. Existing boundary, locale, content, license and target artifact checks ran where applicable. No source edits, deployments or source-map uploads occurred. Earlier verification evidence remains unchanged.

| Target | Command | Result |
| --- | --- | --- |
| facebook | `pnpm --dir packages/portal build:facebook` | passed |
| reddit | `pnpm --dir packages/reddit-app build:package` | passed |
| youtube | `pnpm --dir packages/portal build:youtube` | passed |
| netflix | `pnpm --dir packages/portal build:netflix` | passed |
| yahoo | `pnpm --dir packages/portal build:yahoo` | passed |
| gamesnacks | `pnpm --dir packages/portal build:gamesnacks` | passed |

Reddit includes its browser client, CJS server, package/server tests and complete Devvit package validation. GameSnacks includes local package and metadata preparation. The earlier backend referral suites were not repeated because server source did not change.

Artifact audit results:

- facebook: Facebook artifact audit passed: 416 files, 4.47 MB, 0.64 MB initial resources, isolated SDK/config, and no Jest/native/secrets leakage
- reddit: Reddit artifact audit passed: 429 regular files, 2 entry documents, 3.94 MB, 0.63 MB initial resources, isolated and same-origin only; Devvit package contract passed: 430 regular files/7.45 MiB, isolated inline/game client, CJS server, Redis, and one gateway host
- youtube: YouTube artifact audit passed: 24 files, 1.80 MiB total and conservative initial transfer, 16 locale(s)
- netflix: netflix artifact audit passed: 24 files, 1.80 MiB
- yahoo: yahoo artifact audit passed: 24 files, 1.80 MiB
- gamesnacks: Prepared GameSnacks bundle with 24 runtime files.
