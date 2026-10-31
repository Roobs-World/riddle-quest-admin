# Other target build verification

All six requested target builds passed sequentially against the frozen amendments. Their existing boundary, locale, content, license and artifact checks ran through the target build commands. No deployment, source changes or source-map upload occurred.

| Target | Command | Result |
| --- | --- | --- |
| facebook | `pnpm --dir packages/portal build:facebook` | Passed |
| reddit | `pnpm --dir packages/reddit-app build:package` | Passed |
| youtube | `pnpm --dir packages/portal build:youtube` | Passed |
| netflix | `pnpm --dir packages/portal build:netflix` | Passed |
| yahoo | `pnpm --dir packages/portal build:yahoo` | Passed |
| gamesnacks | `pnpm --dir packages/portal build:gamesnacks` | Passed |

Reddit built and staged the browser client, built its CJS server, passed its 51 package/server tests and validated the complete Devvit package. GameSnacks created its local package and manifest. These are local verification artifacts, with provider publication gates unchanged.

The first attempt was blocked by filesystem sandbox access to pnpm's local SQLite package metadata database. All six initial logs and the exact inventory error are retained separately. The identical license-inventory command succeeded with filesystem escalation; rerunning the unchanged build commands then passed every target. No source fix was needed.

Per-target audit summaries:

- facebook: Web Target boundary audit passed (345 files, 1492 module references).; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; $ node scripts/generate-third-party-licenses.mjs --check; Third-party notices are current (107162 bytes); ../../builds/facebook/third-party-licenses.txt                         25.82 kB │ gzip:   6.30 kB; Facebook artifact audit passed: 416 files, 4.47 MB, 0.64 MB initial resources, isolated SDK/config, and no Jest/native/secrets leakage
- reddit: Web Target boundary audit passed (345 files, 1492 module references).; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; $ node scripts/generate-third-party-licenses.mjs --check; Third-party notices are current (107162 bytes); ../../builds/reddit/third-party-licenses.txt                          7.96 kB │ gzip:  1.80 kB; Reddit artifact audit passed: 429 regular files, 2 entry documents, 3.94 MB, 0.63 MB initial resources, isolated and same-origin only; Devvit package contract passed: 430 regular files/7.45 MiB, isolated inline/game client, CJS server, Redis, and one gateway host
- youtube: Web Target boundary audit passed (345 files, 1492 module references).; YouTube content ready: youtube-content-v1-c9d7fda289aaeb84; 16 locales; 180 riddles per locale; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; ../../builds/youtube/third-party-licenses.txt               1.73 kB │ gzip:  0.89 kB; YouTube artifact audit passed: 24 files, 1.80 MiB total and conservative initial transfer, 16 locale(s)
- netflix: Web Target boundary audit passed (345 files, 1492 module references).; YouTube content ready: youtube-content-v1-c9d7fda289aaeb84; 16 locales; 180 riddles per locale; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; ../../builds/netflix/third-party-licenses.txt               1.79 kB │ gzip:  0.90 kB; netflix artifact audit passed: 24 files, 1.80 MiB
- yahoo: Web Target boundary audit passed (345 files, 1492 module references).; YouTube content ready: youtube-content-v1-c9d7fda289aaeb84; 16 locales; 180 riddles per locale; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; ../../builds/yahoo/third-party-licenses.txt               1.79 kB │ gzip:  0.90 kB; yahoo artifact audit passed: 24 files, 1.80 MiB
- gamesnacks: Web Target boundary audit passed (345 files, 1492 module references).; YouTube content ready: youtube-content-v1-c9d7fda289aaeb84; 16 locales; 180 riddles per locale; Locale audit passed: 16 locales × 23 namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys; ../../builds/gamesnacks/third-party-licenses.txt         1.79 kB │ gzip:  0.90 kB; Prepared GameSnacks bundle with 24 runtime files.
