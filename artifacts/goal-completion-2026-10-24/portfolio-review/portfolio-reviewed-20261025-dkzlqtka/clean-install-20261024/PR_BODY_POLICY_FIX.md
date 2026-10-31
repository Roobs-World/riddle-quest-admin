## Summary

Fix invalid sign-in markup and managed-image responses, isolate full-site verification from remote media, and restore strict clean dependency installation.

```diff
- Hidden Clerk icons retain labels; Blob images redirect; E2E inherits remote media
+ Pinned Clerk UI omits hidden labels; Blob images stream; E2E uses local media
- No-script navigation CSS is emitted in the body
+ No-script navigation CSS lives in the head
```

Explicitly deny core-js’s message-only postinstall through `allowBuilds`, preserving pnpm’s strict handling of unknown dependency scripts. This fixes the exact clean-install failure observed in the first automatic Preview without changing the lockfile or dependency versions.

Use Clerk's documented bundled UI option, exact version `1.41.2` and `prefetchUI={false}`. The patch removes labels only from hidden icons. Compatible dependencies use Sentry's documented config import.

Preserve the existing Sentry filter/tests, public-resource checks, HTML validator and BeeHive/Riddle Quest article sources from the shared checkout. These sources and their recorded publication are retained prior work.

Retain pre-existing commits `4e82914c` and `130686f` above remote base `230a82d`, including `.vercelignore` tool/configuration excludes and the dashboard's Bee demo link. These are retained progress commits.

Package both verification reports and the [sanitised baseline and policy-follow-up summary](https://github.com/Grindhead/Portfolio/blob/55f5fd32f4bbe48ac4db2ba7fda20b8740bbf108/docs/evidence/portfolio-reviewed-source-2026-10-25.md) with the task context.

## Evidence

- **Before:** Local runs rejected body-level no-script CSS and ten Clerk icon attributes. Admin media checks exposed inherited remote storage and an optimizer-breaking Blob redirect.
  **After:** Retained verification passes 370 unit tests with 100% reported coverage, 190 public browser cases plus 22 declared skips, both admin cases and HTML across 204 routes/408 documents.
- **Before:** Bundled UI still prefetched four unused CDN UI scripts.
  **After:** The recorded probe shows anonymous-page isolation, local auth UI chunks, zero remote UI scripts and preserved social-button names.

| Change | Behavior check in the retained verification |
| --- | --- |
| Clerk UI pin, decorative-label patch and auth-only provider options | `tests/e2e/html-conformance.spec.ts`; `tests/e2e/auth.spec.ts`; both `admin-lifecycle.spec.ts` cases; recorded network/name probe |
| No-script CSS placement | `portfolio-usability.spec.ts` test `public navigation is usable on a phone without JavaScript`; HTML conformance |
| Blob image streaming and generic failures | Five tests in `src/server/blob-media-file.test.ts`; recorded read-only local Next optimizer probe returned an image with HTTP 200 |
| Isolated E2E storage and telemetry | Three tests in `scripts/e2e-environment.test.mjs`; authenticated admin media/content lifecycle on the disposable database and local media |
| Existing Sentry filter and public-resource coverage | `src/lib/sentry-server-filter.test.ts`, including a real cancelled React stream; public HTML/Markdown and missing-route cases in `tests/e2e/public-resources.spec.ts` |
| Explicit core-js postinstall denial | Fresh empty-store `pnpm install --frozen-lockfile`: baseline exit 1 reproduced `ERR_PNPM_IGNORED_BUILDS`; policy-inclusive install exit 0, unchanged lock and stable source digest |
| Dependencies/configuration | Recorded build, lint/types, dead-code and production-audit gate; zero high/critical, two moderate and two low findings |
| Existing articles and operations formatting/context | Canonical-page and HTML checks include both article routes; parsed operations JSON equals HEAD; formatting and task-context edits add no runtime behavior |
| Inherited dashboard Bee link and deployment excludes | Admin lifecycle visits the dashboard and opens Content admin; it does not click the Bee link. `/demo/bee` is outside the 204-route HTML inventory. No new deployment-exclusion or Bee-target check is claimed |

HTML validation retains its existing severity treatment: zero errors, 123 warning-class infos and 8,306 other infos.

The dated application results above belong to [baseline commit `480ac243`](https://github.com/Grindhead/Portfolio/blob/480ac243fdd67640f4f4ca223a2af389708a06db/docs/evidence/portfolio-reviewed-source-2026-10-25.md), digest `1bac467e7aa095995aaab7f8f776b83e783589e06d1a84b604345f22ef49fd83` for exactly 363 collected inputs. The policy-inclusive snapshot has digest `c04cf468a4e44b49a0b592432e64a23a0367af7c62f267de823da4f35c867e22` for the same paths. Only `pnpm-workspace.yaml` differs; the other 362 inputs, including the lockfile, are unchanged. This is the collector's defined scope, not an exhaustive application-input inventory. Application unit/browser cases were not rerun for this policy-only delta.

The fresh fixed install used no project credentials or environment files and preserved strict unknown-script enforcement. A fresh local build used guarded existing development keys and local dummy database settings: compilation succeeded, then static blog-tag data collection failed with Prisma `P1001` because no database service was running for that fixture. No fresh successful full build is claimed for this snapshot. Hosted CI remains pending behind the observed account-level startup gate. The [automatic Preview](https://vercel.com/craig-beswethericks-projects-d44935d2/portfolio/ERhEzjRCgHUbTbbPgWvgSr1W7c6n) for `55f5fd32` also passed frozen installation, then stopped at environment validation because `DATABASE_URL` is absent. Isolated Preview resources remain owner-deferred; no environment or credential settings were changed.

The original 29-path package includes formatting-only editor settings with unchanged parsed JSON. Its full-repository formatter check passed; both policy-follow-up files also pass a fresh pinned formatter check. The [summary](https://github.com/Grindhead/Portfolio/blob/55f5fd32f4bbe48ac4db2ba7fda20b8740bbf108/docs/evidence/portfolio-reviewed-source-2026-10-25.md) separates those executed checks from retained application evidence.

Existing production health returned HTTP 200 with database/storage OK at `2026-10-24T04:44:25.543Z`, revision `130686f829331bfc603ba128582cdac1361984aa`. This candidate has not been promoted to production; its hosted readiness remains unverified.

The baseline raw cached whitespace check flags six context lines in the generated vendor patch because unified-diff markers precede vendor tabs. The receipt records that failure and the narrowly scoped patch check; default whitespace rules remain unchanged for every other path. The two-file policy follow-up passes the default staged whitespace check.

## Merge Danger

**Door:** Two-way

Revert dependencies and the UI patch together. The snapshot adds no database migration. Future UI/security updates require patch review and auth/HTML checks.

**Blast Radius:** Website

Auth, public markup, managed images and dependencies are affected. Preview configuration/credentials are unchanged; existing automatic attempts remain enabled and may fail without isolated resources. Production retains its CI-only promotion gates. Local preparation moved no Preview configuration or production alias.
