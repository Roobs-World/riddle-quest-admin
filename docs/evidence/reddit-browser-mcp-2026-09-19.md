# Reddit browser and MCP verification — 2026-09-19

This run used the authenticated Devvit CLI, Firebase MCP, and agent-browser with
the existing Chrome profiles. It did not upload, publish, deploy, change app
settings, enable paid features, or modify game data.

## Live results

- Devvit authenticated as `u/RareAdvertising2367`.
- The private `riddle_quest_dev` community has `riddle-quest` version `0.0.1.21`
  installed. Its private status prevents logged-out hosted gameplay testing.
- The app metadata returned by `devvit view riddle-quest@0.0.1.21 --json` has
  empty `termsAndConditions` and `privacyPolicy` fields.
- Both Chrome profiles (`Default` / craig and `Profile 1` / Grindhead) showed
  logged-out Reddit controls and a 403 at the private app dashboard.
- Browser navigation reached the Reddit login URL, but no usable login form
  appeared in the automated snapshot. An owner browser login is still needed.
- Public GET checks: `/privacy` and `/contact` at `roobsworld.com` returned 200;
  `/terms` and `/terms-and-conditions` returned 404. Availability does not establish
  policy approval or coverage of the game.
- Firebase MCP listed all four HTTPS functions on Node 22 in `us-central1`:
  `exchangeRedditIdentity`, `deleteRedditAccount`, `redditStorage`, `redditGameplay`.
- Deployed Firestore and Storage rules match the repository after normalizing
  line endings and surrounding whitespace.
- The Reddit-functions ERROR log query since September 17 returned no entries.
  This is not proof of successful signed requests or end-to-end connectivity.
- Firebase MCP could not retrieve Realtime Database rules (`Invalid URL`). The
  CLI identified the active default database in `europe-west1`; a direct read-only
  rules check confirmed its parsed JSON matches the repository rules.

Automatic approval review rejected unsigned live POST probes because the request
included a production account-deletion endpoint. Those probes were not executed
or retried through another tool.

## Required input and external evidence

1. Sign in to Reddit as the app owner in Chrome and identify the profile used.
   This unlocks dashboard configuration and authenticated web playtesting.
2. Supply published, owner-approved game Terms and Privacy URLs. The automation
   cannot treat a missing page or an unreviewed website policy as approval.
3. Supply or obtain Reddit fetch/payment approval receipts before enabling the
   corresponding production features. No approval was inferred from installation.
4. Complete physical iOS/Android testing and the additional account-role journeys;
   browser emulation cannot satisfy the repository's physical-device requirement.

The hosted evidence and immutable release gates remain incomplete. Reddit's
[launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide)
requires mobile/web and multiple-account testing before submission. No review
request or publication was submitted by this run.
