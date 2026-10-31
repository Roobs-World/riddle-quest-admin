## Summary

Fix invalid sign-in markup and managed-image responses, and isolate full-site verification from remote media.

```diff
- Hidden Clerk icons retain labels; Blob images redirect; E2E inherits remote media
+ Pinned Clerk UI omits hidden labels; Blob images stream; E2E uses local media
- No-script navigation CSS is emitted in the body
+ No-script navigation CSS lives in the head
```

Use Clerk's documented bundled UI option, exact version `1.41.2` and `prefetchUI={false}`. The patch removes labels only from hidden icons. Compatible dependencies use Sentry's documented config import.

Preserve the existing Sentry filter/tests, public-resource checks, HTML validator and BeeHive/Riddle Quest article sources from the shared checkout. Their earlier publication is not part of this candidate.

Retain pre-existing commits `4e82914c` and `130686f` above remote base `230a82d`, including `.vercelignore` tool/configuration excludes and the dashboard's Bee demo link. Packaging did not author these changes.

Package both verification reports and a [sanitised evidence summary](docs/evidence/portfolio-reviewed-source-2026-10-25.md) with the task context.

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
| Dependencies/configuration | Recorded build, lint/types, dead-code and production-audit gate; zero high/critical, two moderate and two low findings |
| Existing articles and operations formatting/context | Canonical-page and HTML checks include both article routes; parsed operations JSON equals HEAD; formatting and task-context edits add no runtime behavior |
| Inherited dashboard Bee link and deployment excludes | Admin lifecycle visits the dashboard and opens Content admin; it does not click the Bee link. `/demo/bee` is outside the 204-route HTML inventory. No new deployment-exclusion or Bee-target check is claimed |

HTML validation retains its existing severity treatment: zero errors, 123 warning-class infos and 8,306 other infos.

Carried local results use digest `1bac467e7aa095995aaab7f8f776b83e783589e06d1a84b604345f22ef49fd83`; the review receipt records equivalence for exactly 363 collected inputs. This is not an exhaustive application-input claim. This branch has not rerun tests/build or obtained hosted CI acceptance. An account-level CI startup gate prevents jobs from starting; the diagnostic proves eligibility failure only.

The 29-path package includes the original formatted `.vscode/settings.json`; its parsed JSON equals HEAD. The fresh full-repository Prettier check exited 0 with no pre-existing cache, using the original pinned toolchain and a temporary ignored dependency symlink that was removed. `candidate-format-check.json` records the result. No install, application test or build was run; application results remain carried evidence.

Existing production health returned HTTP 200 with database/storage OK at `2026-10-24T04:44:25.543Z`, revision `130686f829331bfc603ba128582cdac1361984aa`. This candidate is not deployed and its hosted readiness remains unverified.

The raw cached whitespace check flags six context lines in the generated vendor patch because unified-diff markers precede vendor tabs. The receipt records that failure and the narrowly scoped patch check; default whitespace rules remain unchanged for every other path.

## Merge Danger

**Door:** Two-way

Revert dependencies and the UI patch together. The snapshot adds no database migration. Future UI/security updates require patch review and auth/HTML checks.

**Blast Radius:** Website

Auth, public markup, managed images and dependencies are affected. Preview configuration/credentials are unchanged; existing automatic attempts remain enabled and may fail without isolated resources. Production retains its CI-only promotion gates. Local preparation moved no Preview configuration or production alias.
