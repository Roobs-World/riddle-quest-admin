# Facebook configuration readiness — 1 October 2026

The local predeployment environment now permits Facebook native bot-subscription
prompts. Its off list is `FACEBOOK_DISABLED_FEATURES=commerce,rewarded_ads`.
The tracked environment example matches. This removes a leftover gate from before
the real notification adapter was implemented; it does not change deployed Functions
configuration or activate any notification template.

The compiled production configuration resolver was run against the actual local
off list. It returns `notificationsEnabled: true`, `commerceEnabled: false` and
`rewardedAdsEnabled: false`. Prompt composition still requires authenticated
configuration, the configured `13_plus` audience and all three advertised Meta
player subscription APIs. The server lease requires an authoritative win, remembers
acceptance permanently and limits retries to seven days. Meta subscription state
must confirm acceptance after the native dialog. Unsupported APIs, unknown age,
configuration failure, dismissal and occupied SDK dialogs remain independently
handled. No Jest notification implementation is used by Facebook.

All four required nonsecret Facebook backend configuration values are present, and
`REQUIRE_FACEBOOK_DEPLOY_CONFIG=1 pnpm --dir firebase-functions validate:deploy-env`
passes. Read-only Firebase MCP app listing and SDK configuration confirm that
`1:329028367192:web:9b535c8edb2639f8b7eb2d` is the active **Riddle Quest Facebook**
web app in `riddle-quest-ec2b2`, matching the Facebook client and backend configuration.
Evidence retains only public configuration fields; no API key or secret value is
copied. This validates configuration syntax and app association, not secret rotation,
deployed settings, effective Meta-hosted CSP or role-account/device acceptance.

Purchases remain disabled until actual signed purchase and refund fixtures establish
the server verifier contract and payment setup is valid. Rewarded grants remain
disabled until completion is verifiable by the authoritative backend; browser video
completion cannot grant coins. Subscription consent does not implement individual
message scheduling, cancellation or delivery. Reminder drafts are still review-only.

Executed verification is retained in the
[manifest](../../artifacts/facebook-config-review-2026-10-01/manifest.json) and
[validation logs](../../artifacts/facebook-config-review-2026-10-01/validation/):

- Client notification, prompt coordinator/policy, age gating and bootstrap: 45 tests
  across five suites passed.
- Backend configuration and prompt lease/callables: 24 tests across three suites
  passed, also repeated under the pinned Node 22 runtime.
- Injected Facebook SDK browser journey passed, including the authoritative-win
  subscription prompt and acceptance before the result interstitial.
- Jest, Facebook, Reddit, YouTube, Netflix and Yahoo builds and artifact isolation
  audits passed. Reddit package contract checks: 35 tests passed.
- The rebuilt Facebook artifact matches all 399 entries of the previous
  [browser-tested tournament-entry candidate](facebook-native-tournament-entry-2026-10-01.md);
  all 41 selected client source hashes also match. No client source or visible copy
  changed in this configuration follow-up.
- The tracker initially failed because its expected timestamp still referred to the
  previous capture. The fixture was updated to the new evidence timestamp and rerun.

The Facebook Marketing MCP remains registered but unauthenticated after Meta rejected
automatic OAuth registration, as recorded in the
[SDK follow-up](facebook-sdk-followup-2026-10-01.md). It does not provide Instant
Games release APIs. No MCP reinstallation, upload, deployment, payment, publication,
message send or template activation occurred in this follow-up. The working tree
remains dirty and does not establish canonical upload eligibility.

Hosted testing must use the reviewed backend configuration and exact client artifact,
then cover eligible consent, dismissal, accepted subscription, weekly retry and
unsupported/unknown-age cases on web, iOS and Android. Secret/IAM proof, real identity
fixtures, CSP, physical retention rollout and the other provider acceptance gates
remain open in the tracker.
