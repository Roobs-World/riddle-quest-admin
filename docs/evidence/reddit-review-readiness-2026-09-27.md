# Reddit review readiness — 2026-09-27

Scope: read-only provider checks and local Reddit package validation. No app
version was uploaded, installed, published, or submitted for review. No Jest or
Facebook configuration was changed.

## Verified today

- Devvit CLI is authenticated as the app owner, `u/RareAdvertising2367`.
  `devvit view riddle-quest@0.0.1.23 --json` shows the private app metadata,
  Terms URL, general Privacy URL, six-product payments configuration, and Devvit
  API version `0.14.1`. `devvit list installs riddle_quest_dev` confirms that
  version is installed. The uploaded README still names the denied
  `us-central1-riddle-quest-ec2b2.cloudfunctions.net` host. Hosted logs report
  `PERMISSION_DENIED` for that hostname.
- The current local `devvit.json`, server bundle, and README name only
  `www.roobsworld.com` for the fixed signed gateway. `pnpm build:reddit` passed
  target boundaries, 17-locale coverage, production artifact audit, server
  typecheck, 31 package tests, and the Devvit package contract. The injected
  Reddit Playwright test passed. The resulting package is 7.07 MiB with both
  entry points and one CJS server.
- The website checkout contains the four-route proxy and Reddit-specific
  privacy content, but the public domain serves an earlier deployment. An
  unsigned POST to the fixed proxy route returns HTTP 200 HTML instead of the
  route's HTTP 401 JSON `signature-required`. The new
  `pnpm --filter @qwordly/reddit-app check:hosted-gateway` check fails for this
  exact reason. The public Privacy page also lacks the new Reddit-specific text.
- The browser at the [app's Developer Settings](https://developers.reddit.com/apps/riddle-quest/developer-settings)
  is signed out and returns 403. The CLI can read app metadata, but it does not
  provide an authenticated portal editing session or show approval for the new
  hostname. No portal fields were changed.
- `validate:contracts` fails because all six provenance-bound hosted fixtures
  are absent. That is expected until actual Reddit-hosted payloads can be
  captured. The private installation cannot furnish authenticated gateway
  evidence while its old fetch host remains denied.

## Review path, in order

1. Use the Vercel account and project that own the public `www.roobsworld.com`
   deployment to publish the already implemented proxy and Reddit privacy
   content. The Vercel CLI session currently available here is linked to a
   different `portfolio` project and cannot inspect the public deployment ID.
   Verify the fixed route with `check:hosted-gateway` and review the live Privacy
   page before changing Reddit metadata.
2. Sign in to the Reddit developer portal as the app owner. Confirm the request
   status for `www.roobsworld.com`, the exact rejection reason for the old host,
   the six Gold products, and the saved Terms/Privacy details. Update the
   privacy URL only after its published text covers this game's data flows.
   Reddit's [HTTP Fetch Policy](https://developers.reddit.com/docs/capabilities/http-fetch)
   treats personal domains as exception requests; a domain change alone cannot
   prove approval.
3. Once the proxy is live and the fetch request can be reviewed, create a new
   private playtest version with the established explicit-version upload
   workflow. Keep it private; inspect the exact uploaded version and install it
   only in the test community. Check authenticated session, storage, gameplay,
   save, account deletion, and payments on Reddit web, then physical mobile
   devices and each required role. Capture real sanitized contracts and hosted
   evidence. Keep production commerce disabled until Reddit approval is recorded.
4. Run the immutable candidate and promotion gates only after the external
   evidence exists. This work does not authorize `devvit publish` or a review
   submission.

The local package is technically valid, but the hosted integration and developer
portal are not yet review-ready. Do not label either as approved based on local
tests or app metadata alone.
