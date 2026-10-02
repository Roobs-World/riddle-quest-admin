# Authenticated Meta readiness checks — 2 October 2026

The official Meta Social Technologies MCP is authenticated and callable in this
chat. Its app inventory confirms Riddle Quest (`1748953042991569`), the owner's
admin role, business portfolio access, and **read-only** caller permission. This
supersedes the unauthenticated state recorded on 1 October. Other apps returned by
the inventory were excluded from repository evidence. No permissions were expanded.

The bounded app-specific read results are retained in
`artifacts/meta-facebook-readiness-2026-10-02/provider-read-results.json`.
Basic/advanced settings, security, restrictions, App Review status/requirements/
privileges/history, compliance, webhook topics/subscriptions and API deprecations
were inspected through MCP. Contact-email contents, the transient icon URL and
secret-shaped fields are excluded/redacted. No token or credential is retained.

Current provider observations:

- The app is in development mode and is not live. Its age restriction is 13+.
  The owning business passes the review-requirements response's business check;
  this does not independently prove Approved Partner acceptance.
- The configured game privacy and terms URLs both resolve over HTTPS with HTTP
  200 and the expected page titles. The general privacy and legal landing pages
  also resolve. Bounded hashes/titles are in `public-url-checks.json`; this is
  reachability evidence, not legal/content approval.
- Basic settings report no data-deletion URL, support URL or base domains, and an
  unverified contact email. Advanced settings report no configured JavaScript SDK
  host domains. These generic fields do not expose the full Instant Games CSP
  allowlist, so an absent field must not be treated as proof that every game
  network request is blocked. Security reports that mandatory 2FA is disabled;
  review the app's security settings before release.
- Review responses contradict one another: status reports an unsubmitted record
  with its approved boolean true; requirements disallow submission because an
  earlier submission is allegedly under review; history reports no prior reviews;
  privileges list Zero Permission access as rejected/not live, with no reason.
  None of these alone proves approval or a currently pending review. A subsequent
  read-only Chrome dashboard check visibly shows **Not submitted**, with Instant
  Games Zero Permission Access under New requests and a Next link. The link's
  draft submission ID differs from the MCP response's ID. This establishes the
  visible Zero Permission draft state, not rejection history or another review.
  No Next, remove or submit action was taken. Preserve the MCP discrepancy and
  reconcile it before submission; do not treat its approval boolean as acceptance.
- Compliance reports no required actions or open violations. Graph API health
  reports v26.0 and no listed deprecations. Neither proves game quality approval.
- No webhook subscription exists. The available generic payment topic is not
  evidence of an enabled Instant Games V2 purchase/refund subscription or payload.

Firebase MCP independently confirms the active project `riddle-quest-ec2b2` and
the deployed deletion callback/status functions in `us-central1`. A metadata-only
gcloud read confirms the callback is ACTIVE, at
`https://facebookdatadeletioncallback-h5dplxxwha-uc.a.run.app`, and configures
`https://facebookdatadeletionstatus-h5dplxxwha-uc.a.run.app` as its status base URL.
Unsigned GET probes inspect reachability/rejection only; no signed request, account
deletion, document read or production write was performed. The first gcloud read
used the wrong region and returned 404; it is not evidence of function absence.
Correct-region metadata and probe results are retained in
`deletion-endpoint-metadata.json`. The callback can be entered into Meta's settings
only after the existing secret/rollout and signed acceptance checks establish that
the deployed implementation is ready; this pass does not change the dashboard.

New documentation evidence narrows the integration work:

- [The Zero Permissions notification reference](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/notifications)
  documents server POST endpoints on `graph.fb.gg` for sending and cancelling
  notifications. Scheduling uses `schedule_interval`; cancellation can be scoped
  by `label`, and a recipient can have at most five pending scheduled items.
  This supplies a concrete provider route for the staged D1/D3/D7 design. The
  server adapter, token/access validation, consent enforcement, ambiguous-outcome
  handling and real success/error fixtures remain to be implemented/proven before
  activation. The separate Notification Service guide's SDK scheduling examples
  do not establish support in the currently loaded v8 root API. The native bot
  subscription prompt remains a separate, already implemented capability.
- [The v8 payments reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments)
  specifies signed receipt fields for algorithm, issuance/app scope, consumption,
  payment action/ID, product, price, purchase token/time and developer payload.
  The introductory IAP guide describes a different shortened payload, including
  player identity. Select the actual v8 receipt shape using a real signed fixture;
  do not add an assumed field or weaken account binding to reconcile prose.
  The ledger's `VerifiedFacebookPurchase` input remains an internal boundary,
  not proof that a public cryptographic verifier exists.
- [The game changelog](https://developers.facebook.com/documentation/games/changelog/)
  announces IAP V2 purchase/refund webhooks and a replacement two-step bundle
  upload service. A generic Messenger/WhatsApp webhook signature example cannot
  establish the Instant Games V2 envelope or exact-byte bundle ingestion contract.
  Those detailed contracts and real app-specific payloads remain outstanding.
- [The Instant Games rewarded-ad guide](https://developers.facebook.com/documentation/games/monetize/in-app-ads/rewarded-ads)
  describes client completion and frequency validation; the documentation search
  also returns native Android/iOS/Unity server-validation guides. Those native
  SDK contracts cannot be imported into this HTML5 game. No server-verifiable
  FBInstant reward receipt was established, so the coin grant remains disabled.

Search result URLs/queries are retained, rather than republishing full Meta
documentation. The web reader could not open the two requested Meta references;
the authenticated official MCP documentation search supplied the inspected content.

Facebook P0-02 and P5-10 now reference the current provider observations instead
of reporting unauthenticated MCP access or an entirely unidentified notification
route. Their acceptance criteria remain incomplete. Existing real-receipt,
device, approval, translation, IAM and release gates were not relaxed. Six fresh
isolated target builds and their artifact audits passed. This pass changes only
readiness evidence/tracker metadata; concurrent game changes belong to other work.
No hosted/device acceptance or full runtime test rerun is claimed by these builds.
No backend rollout, provider setting, webhook subscription, upload, transaction,
reward, notification delivery or public promotion occurred. The goal remains active.
