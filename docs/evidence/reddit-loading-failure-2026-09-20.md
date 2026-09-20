# Reddit loading failure — 2026-09-20

Hosted authenticated play is blocked by Reddit's denied external-fetch domain.
No application fix or redeployment can grant this provider permission.

## Live evidence

- `devvit list installs riddle_quest_dev` confirms Riddle Quest `0.0.1.23`.
- `devvit logs riddle_quest_dev riddle-quest --since 24h` returned:

  ```text
  PERMISSION_DENIED: grpc invocation failed with status 7;
  HTTP request to domain: us-central1-riddle-quest-ec2b2.cloudfunctions.net is not allowed
  ```

  The stack reaches `callFirebase`. This blocks the gateway before Firebase can
  service the request.
- A read-only call to the installed Devvit CLI client's
  `createAppClient().GetBySlug({slug: "riddle-quest"})` returned the domain request
  with status `2`. The installed `FetchDomainRequestStatus` enum defines this as
  `DENIED`. Created: `2026-08-20T18:53:41.168Z`; last updated:
  `2026-08-21T19:53:24.204Z`. The returned record does not give a denial reason.
- Agent-browser opened the private playtest at
  `https://www.reddit.com/r/riddle_quest_dev/?playtest=riddle-quest`.
  The available session is logged out and displays “r/riddle_quest_dev is private”.
  Consequently this run could not inspect the actual authenticated game iframe.

## Browser reproduction and local checks

- A local Playwright replay served the actual built Reddit client, injected the
  Devvit expanded-view context, and returned HTTP 500 for `/api/session`, matching
  the server's unhandled fetch-failure path. The game displayed “Could not
  connect.” Clicking Retry repeated the error and issued another session request.
  Changing only the session response to a successful anonymous session allowed
  Retry to load the bundled guest riddle. This is a local reproduction, not a
  successful hosted authenticated session.
- `pnpm --filter @qwordly/portal test:reddit:playwright` passed. Its injected
  harness covers expansion, guest and authenticated startup, all 17 locales,
  simulated checkout cancellation/success and balance reload, race/tournament
  surfaces, settings, and same-origin API requests.
- `pnpm --filter @qwordly/reddit-app validate` passed: typecheck, 31 tests, and
  package validation.
- The four Reddit client unit suites passed all 33 tests. Rebuilding and staging
  the complete Devvit package with `build:package:from-client` also passed its
  typecheck, 31 tests, and package validation.
- `pnpm --filter @qwordly/portal build:all-targets` passed all six isolated target
  builds and artifact audits. YouTube used the explicitly non-release engineering
  fixture selected by this command.

## Required unblock

The owner must resolve the denied domain request with Reddit through the app's
[Developer Settings](https://developers.reddit.com/apps/riddle-quest/developer-settings).
The existing [fetch review explanation](reddit-approval-preparation-2026-09-19.md#fetch-review-text)
documents the fixed endpoints and need for the global account/economy backend.
Reddit's [HTTP Fetch documentation](https://developers.reddit.com/docs/capabilities/server/http-fetch)
explains that upload/playtest requests review; declaring the host does not approve it.

After Reddit grants access, repeat authenticated hosted startup and inspect
session, storage, profile, riddle, and save requests before claiming the deployment
works. Other downstream issues cannot be ruled out while fetch is denied.
The browser also needs an owner login to access the private playtest.

No secrets, feature flags, provider permissions, application code, or deployments
were changed. No message or review request was sent to Reddit.
