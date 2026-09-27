# Facebook game privacy URL publication — 27 September 2026

## Published result

- Public URL: https://roobsworld.com/riddle-quest/privacy (HTTP 200 without authentication).
- Meta app `1748953042991569` → App settings → Basic → Privacy policy URL was changed from `https://roobsworld.com/privacy` to the dedicated URL. A portal reload confirmed the new value persisted. No review or publish action was taken in Meta.
- Vercel project: `portfolio` (`prj_ePBIvzdYBmEXARehORy9MExKUlRQ`) in team `team_vAXlm6zrxxYVKlhz90UrbIig`. Final promoted deployment: `dpl_4dUr4D2ZtpJMZxfcw64J5DEeXHBT`. Previous live deployment: `dpl_7f5iyRfrZvxVs4vJzHN2YgT2TSY7`.
- The portfolio repository owns the website source at `/home/craig-beswetherick/Documents/portfolio/src/app/riddle-quest/privacy/page.tsx`. Page SHA-256: `9cb9ed1175f8b0a327413e2f62b9a3a54e0f1bea0453dc3c1c6dbaf7e9472bba`.

## Release scope

Restored and SHA-1 verified all 230 source files from the previous live Vercel deployment into an isolated release directory. The promoted source differs only in the new Facebook privacy route, a link from `/riddle-quest/terms`, and a sitemap entry using the absolute public URL. This preserved the existing portfolio privacy page and avoided publishing unrelated changes from the local website checkout. The corresponding source changes were also made in that checkout for future releases.

The notice is scoped to Facebook Instant Games. It describes the current Testing build with purchases disabled, player data and social processing, providers, retention limitations, deletion and contact rights. It does not claim that the still-pending transfer, retention and deletion checks are complete. The working draft and open review gates are in [the Facebook privacy draft](../../facebook-privacy-draft.md).

## Verification

- ESLint and Prettier passed for the changed website files. The isolated Next.js build completed and included `/riddle-quest/privacy`. The final Vercel deployment built successfully.
- Browser checks on the protected candidate and the public domain confirmed the page title, six sections, an absolute canonical URL, terms link, and no horizontal overflow at 390px. No browser errors were reported. Public mobile screenshot: `/tmp/roobs-facebook-privacy-live-390.png`.
- After promotion, `/`, `/privacy`, `/riddle-quest/terms`, `/riddle-quest/privacy` and `/sitemap.xml` all returned HTTP 200. The sitemap contains the dedicated `roobsworld.com` URL once and no deployment-host privacy URL. The existing portfolio home content remained present on the production candidate.
- Jest, Facebook, Reddit, YouTube, Netflix and Yahoo game artifact builds passed. No Jest configuration or game artifact source was changed for this URL publication.

## Operational follow-up

The Vercel dashboard lists encrypted `DATABASE_URL` entries for Production and Preview (`fresh-start`). During this release, CLI environment pulls rendered `DATABASE_URL` as `""`, and a build without an override failed environment validation. That result does not establish whether the stored secret itself is empty or whether the CLI returned an empty value for another reason. The verified deployment received the working website database URL as a deployment-specific build and runtime value without exposing it in source or this record. Before the next routine website deployment, verify that its build and runtime receive a working database URL and that portfolio content remains present; a candidate without the override returned an environment-validation error or omitted portfolio entries. The Facebook privacy draft also lists policy and deletion checks still required before game review submission.
