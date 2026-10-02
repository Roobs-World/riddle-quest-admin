# Facebook and Reddit readiness audit — 1 October 2026

The current local builds are prepared for further testing. Neither provider is
ready for a review submission or public deployment. This audit records the
remaining acceptance requirements without replacing provider evidence with
injected SDK tests, changing release gates, or activating unverified economy paths.

The requirement snapshot in
`artifacts/facebook-reddit-readiness-audit-2026-10-01/requirements.json` retains all
102 tracker rows, including their acceptance criteria, evidence text and blockers.
Facebook claims 20 of 53 complete, with 33 outstanding; Reddit claims 36 of 49
complete, with 13 outstanding. These are historical tracker claims, not 56 new
independent acceptance verifications. Facebook P0-02 now correctly says In Progress:
documented app/Firebase setup and local SDK configuration already exist, while
independent settings/role/URL review and Meta-hosted acceptance remain outstanding.

Fresh verification in `verification.json` confirms all six current client build
directories exactly match the preceding context-dialog review manifest: Jest 399,
Facebook 399, Reddit 412, and YouTube/Netflix/Yahoo eight files each. Forty-eight
selected runtime/test/locale source files across the Facebook dialog, Reddit
canonical-post and backend presence-quota reviews also match their saved hashes.
This is a selected-source check, not proof of the entire dirty checkout. The
current Devvit server bundle matches the canonical-post review hash. The earlier
passing builds, artifact audits, 1,465 portal tests and three injected browser
checks remain recorded in
[the context-dialog evidence](facebook-context-dialog-2026-10-01.md). This
documentation-only audit did not repeat those runtime checks or modify game UI.

The Facebook local review ZIP remains read-only (`0400`), contains 399 entries,
and every entry matches the current Facebook build. Its size is 2,763,182 bytes;
SHA-256 is `e908eb7f81d96084e9fec79f1a97d2cb0616242c2673fc57eb818f26071bd6cf`.
It remains local-review-only and upload-ineligible. No clean-source release receipt
or reviewed provider upload is implied.

Remaining provider and owner work:

- Meta Social Technologies MCP is registered with its eight read-tool allowlist,
  but the fresh CLI registry reports `not_logged_in`. The Ads MCP is also
  unauthenticated. There is no running `facebook_devtools` login process; the old
  callback expired. The existing consent question remains unanswered. App access
  must be authorized before a fresh read-scoped connection and returned app,
  review, compliance or webhook evidence can establish the actual provider state.
  See [the connection evidence](meta-social-technologies-mcp-2026-10-01.md).
- Facebook needs actual signed identity, purchase/refund and notification payloads,
  provider approvals and role/device acceptance. Purchases cannot grant balances
  until the real signed-purchase/refund verifier boundary is proven. Rewarded
  currency cannot rely on client `showAsync` completion; a server-verifiable
  provider receipt/callback or an approved reward-design change is required.
  The native bot-consent prompt is locally implemented and covered by the injected
  harness, but live notification activation and reminder delivery are unverified.
  No undocumented scheduling/replacement API has been invented.
- Reddit contract validation freshly fails because all six genuine fixture types
  are missing: auth, payment, refund, post-entry, realtime and notification.
  Hosted validation freshly fails with `reddit-hosted-evidence-missing`. Both
  failures are retained in `validation/`. The configured Devvit/Firebase stdio
  MCP registry's `unsupported` auth status does not establish an authentication
  failure or provider approval. Approved outbound access, signed forwarding,
  products/payout and notification beta evidence remain provider-owned gates.
- Both providers need exact private-package/install receipts, real hosted web,
  iOS and Android journeys, and reviewed backend rollout evidence. Prepared
  identity/referral/context TTL work, Reddit profile cleanup/indexes, operation
  limits, dependent security rules and provider-specific IAM require deployment
  and physical-retention acceptance. Selected local hashes cannot establish that
  these changes are live. Canonical-post ambiguity requires provider inspection
  and reviewed installation maintenance before any retry; its pending marker
  must not be reset automatically.
- The translated race corpus remains incomplete: the unchanged 180-riddle source
  and four checkpoint hashes match their manifests, with 90 drafts, 89 accepted
  automated critiques and zero eligible locale bundles out of 16 (2,880 required
  translations). Native answers exceeding the seven-grapheme limit require the
  owner's source/content decision. No source answer, answer limit, human-review
  claim or imported content was changed. See
  [the translation evidence](facebook-translation-generation-2026-10-01.md).
- The shared checkout remains dirty and contains other ongoing work. A complete
  reviewed source identity, immutable release handoff, actual provider draft
  acceptance and manually authorized public promotion are still required.

Tracker tests and both progress validators pass after the setup-status correction.
No account access, provider setting, production data, secret, IAM grant, deployment,
upload, purchase, ad reward, notification or public promotion was changed by this
audit. The repeated external blockers remain unresolved; the goal is incomplete.
