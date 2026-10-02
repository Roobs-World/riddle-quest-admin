# Facebook native context dialog exclusion — 1 October 2026

Meta context selection and native matchmaking bypassed the SDK-instance dialog
guard already used by result ads, bot subscription prompts, referrals and tournament
sharing. Two new public-adapter tests reproduced a successful interstitial request
while the context or match SDK promise remained unresolved.

Both `context.chooseAsync` and `matchPlayerAsync` now use that same guard. Competing
operations return the existing unavailable result without calling the SDK. The
guard now preserves typed context results as well as void ad/share/prompt results.
It releases on success, cancellation and failure. Match-tag validation still occurs
before opening provider UI, and the existing age, supported-API and authenticated
configuration gates are unchanged. No new UI text or locale key was added.

Current validation is retained under
`artifacts/facebook-context-dialog-review-2026-10-01/validation`:

- The two initial failing overlap tests are retained in `reproduction.log`.
  Five new cases cover both native operations blocking ads/prompts/each other,
  active ads blocking context/match calls, and both operations releasing the guard
  after cancellation or failure. The full portal passed 172 suites/1,465 tests;
  95 tests remain opt-in and were skipped in that unit invocation.
- Injected Facebook, Jest and Reddit browser suites each passed one test. The
  Facebook harness rebuilt its own explicit 13+ fixture and exercised context
  cancellation/recovery, native tournaments, sharing, bot prompts, profile overlays,
  authoritative play and provider lifecycle. These are injected SDK/backend tests,
  not Meta-hosted acceptance or physical-device evidence.
- All six isolated builds and artifact audits passed. Jest, Reddit, YouTube,
  Netflix and Yahoo match the retained reference byte for byte. Only Facebook
  artifact entries changed. The Reddit server was not modified in this turn.
- Portal TypeScript, source documentation/size checks, commerce activation and
  server-only secret boundary checks passed. Staged unverified commerce remains
  unreachable; this fix does not enable purchases or rewarded grants.

The fresh root-content local review ZIP is
`artifacts/facebook-context-dialog-review-2026-10-01/riddle-quest-facebook-context-dialog-local-review.zip`:
399 entries, 2,763,182 bytes, SHA-256
`e908eb7f81d96084e9fec79f1a97d2cb0616242c2673fc57eb818f26071bd6cf`.
Every archive entry matches the newly built Facebook artifact; the snapshot is
read-only (`0400`). It supersedes the prior tournament-entry ZIP for local inspection
of current client source. It is **not** a clean-source release handoff or an upload
instruction. The existing receipt process and pending-upload protections remain
required before any Meta draft upload.

No provider account access, SDK-hosted transaction, deployment, upload, reminder
activation or public promotion occurred. The official Meta MCP is registered but
its account authorization still awaits the existing user approval. Hosted SDK/API,
age, CSP, cloud-save, social, payment/refund, notification and physical-device
acceptance remain outstanding, as do the full translated content corpus and clean
source identity. This local fix does not complete those review gates.
