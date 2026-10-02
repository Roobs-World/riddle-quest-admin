# Reddit Live PvP first-win referrals — 2 October 2026

The real live service committed the normal 50-coin victory and
`stats.multiplayerWins`, but queued no Reddit referral work. Both winning-seat
regressions failed with zero outbox receipts. A separate ledger regression then
proved that the existing Reddit settlement required a solo win. Post attribution
was already bound correctly before the match; it was not the missing step.

The live winner transaction now creates a `reddit_live` receipt in the existing
`racePerformanceOutbox`, alongside its ordinary win grant. It records an immutable
Reddit-specific private match binding. The receipt uses a separate hash domain
from Facebook live work and chosen legacy recorded-race request IDs. Facebook's
existing domain and persisted bindings remain compatible. A common private
source validator applies the same authority checks to each provider, while the
provider adapters select their own canonical UID, feature switch and ledger.
Jest wins create neither provider's live referral work.

Delivery checks the receipt discriminator, exact hash, owned ticket/match, private
human winner, committed 50-coin grant, multiplayer win counter, binding clock,
retention and account deletion. Public terminal projections and browser currency
claims establish no authority. Live referral work does not become a recorded-race
speed sample. Existing retry-enabled events and bounded recovery consume it;
operator dry-run/replay validates the private source before releasing a repaired
receipt. Grant precedes acknowledgement, so retries after either failure cannot
grant twice. Corrupt source metadata is quarantined; missing/expired/deleted
authority and the Reddit referral emergency switch suppress pending work.

The Reddit ledger now accepts an authoritative solo or multiplayer win. Older
profiles may omit multiplayer counters; malformed present counters still fail.
New bindings reject established multiplayer wins, game participation or challenge
creation, alongside the existing solo/purchase checks. A real live-win regression
proves that joining a new referral post after winning cannot create a first
binding. Existing bindings keep their idempotent retry behavior. Trusted post,
locale and sandbox/production provenance remains server-owned and hashed; these
changes add no browser attribution fields or provider API permissions.

The reward policy is unchanged: one lifetime 100-coin invitee reward; 100 coins to
the inviter only below five rewarded conversions per UTC day. Human wins over
the server fallback bot and authoritative after-start forfeit wins qualify.
Ties, losing players and bots receive no referral grant. Missing/deleted inviters
retain the existing ledger policy. Balances are asynchronous server state and
become visible through authoritative profile refresh; the client does not add an
optimistic referral bonus to the live match's original coin receipt.

Executed evidence under `artifacts/reddit-live-referral-2026-10-02/`:

- **157 real Firestore-emulator integration tests pass across seven suites**,
  including **27 Reddit live-referral cases**, all 23 Facebook live-referral
  cases, live gameplay, recorded settlement, native Facebook tournament and both
  provider referral-cap regressions. Coverage includes both seats, trusted post
  attribution, repeat wins, fallback bot, forfeit/ties, grant/ack failure, backoff
  and queue recovery, deletion, retention, disabled referrals, corruption,
  dry-run/repair/replay, provider substitution and six concurrent conversions.
- **152 Functions unit tests pass across 12 suites on Node 22**, including Reddit
  eligibility, receipt schemas, Facebook referrals, live scoring and single-player
  completion/security regressions. The first broader command used a nonexistent
  completion-test filename; that diagnostic is retained, and the final command
  uses the actual completion suites. **Five operator CLI tests pass**.
- Functions types, production module-cycle checks and changed-file lint pass.
  The private Functions emit loads the new provider modules on Node 22.23.1;
  compiled checks prove Facebook's hash is unchanged and all three hash domains
  are distinct. No provider request is issued by that runtime check.
- **325 Jest adapter unit tests pass across 31 suites**.
- All **six fresh isolated production builds and explicit-directory SDK audits
  pass**: Facebook, Reddit, Jest, YouTube, Netflix and Yahoo.
- Fresh injected production-artifact Facebook and Reddit Chromium journeys pass.
  They validate client/provider behavior; real economy authority is proven by the
  emulator tests, not the browser fixtures.
- `git diff --check` passes.

The build outputs are retained outside the shared checkout at
`~/.cache/riddle-quest-review/reddit-live-referral-20261002/`. Source/log/artifact
hashes are diagnostic evidence from the shared working tree, not an immutable
upload candidate or proof of deployed bytes. No new callable, collection,
trigger, scheduled job, SDK or approval flag is added. Deploy the producer and
delivery/replay changes together in the reviewed backend release. Real signed
Reddit post-entry/binding/first-win acceptance, approved hosted gateway and
physical-device evidence remain outstanding. The 31 previously unmigrated
recorded-race browser cases also remain unresolved. Account-deletion coverage of
private live-match records requires a separate review; the existing outbox owner
sweep does not prove that broader cleanup. No deployment, provider settings
change, real reward grant, purchase or notification send was performed by this
work.


Follow-up: [live account-deletion verification](live-race-deletion-2026-10-02.md)
now exercises the private live-match cleanup and preserves a surviving Facebook
or Reddit winner's pending first-win referral. The earlier unverified cleanup
statement above describes the state at the time of that referral-only run.
