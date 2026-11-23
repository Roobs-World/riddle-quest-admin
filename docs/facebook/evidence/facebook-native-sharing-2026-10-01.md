# Facebook native sharing and first-win referrals — 1 October 2026

Status: implemented and locally tested; hosted provider acceptance remains incomplete.
The Facebook tracker now records 20/53 tasks complete; first-win referral settlement
is complete locally. The subsequent [referral retention follow-up](facebook-referral-retention-2026-10-01.md) implements TTL and safe legacy backfill; deployed cleanup acceptance remains outstanding. This document and its ZIP retain their original source provenance.
No provider upload, deployment, notification activation/send, or payment was performed.

This follows the [Facebook/Reddit review preparation](../../common/releases/evidence/facebook-reddit-review-followup-2026-10-01.md).
Its earlier ZIPs remain historical snapshots and do not contain this follow-up.

## Implemented behavior

- Facebook profile invitations, solo result sharing and published race sharing use
  `FBInstant.shareAsync`. Meta owns the dialog. A local PNG card contains bounded
  game text/results, with no DOM/profile capture or provider identity.
- The authenticated `createFacebookReferral` callable issues the opaque token.
  The browser validates token shape/expiry before sharing. The entry envelope
  contains only the token and an optional game mode or published challenge ID,
  fits the SDK's 1KB data contract, and uses `switchContext: false`.
- Incoming published challenge IDs enter the existing race authority. Entry data
  cannot nominate a player, score, answer, reward amount, or winning result.
- Unknown audiences, disabled authenticated referral configuration and unsupported
  native APIs hide sharing. Account deletion/unmount prevents delayed dialogs.
  Shares, ads and bot-subscription prompts share the same SDK-instance dialog gate.
  Expected Meta cancellation releases the gate for a later user-initiated retry.
- Facebook uses plain localized invite/challenge labels in all 16 locales. Jest's
  existing copy and SDK attribution/reminder flows remain unchanged. The shared
  PNG result-card renderer is provider-neutral; Jest retains its old import via a
  re-export. No new provider SDK enters another target.
- Binding now rejects existing multiplayer games, wins or published challenges,
  as well as existing solo play/purchases. Missing historical multiplayer counters
  mean zero; malformed present values remain invalid.
- First verified solo or multiplayer wins can settle the two-sided 100-coin
  referral. The existing five-conversions-per-UTC-day referrer cap remains.
  Meta share completion itself grants nothing.
- Both challenger-win and creator-win race paths retain their durable outbox until
  the idempotent referral grant succeeds. The owner performance marker and creator
  inbox receipt prevent duplicate projection/achievement writes. A crash between
  grant and acknowledgement safely replays the existing referral settlement.
  Non-Facebook deliveries retain their original transaction and acknowledgement path.

SDK contract references: [Meta-hosted HTML5 v8 SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js)
and [Meta's API reference](https://facebook.github.io/meta-instant-games-unity-plugin/documentation/API_REFERENCE.html).
The HTML5 SDK remains externally injected by the Facebook artifact, not vendored.
The reference is contract corroboration; no Unity or native code was added.

## Verification

Current logs are retained in [validation](../../../artifacts/facebook-sharing-review-2026-10-01/validation/).

| Check | Result |
| --- | --- |
| Portal unit tests | 169 suites / 1,434 tests passed; 95 opt-in tests skipped |
| Backend unit tests | 114 suites / 1,378 tests passed under Node 22, including the final receipt parser |
| Referral cap emulator | Six concurrent invitees produce six invitee rewards and exactly five referrer rewards; replay leaves balances unchanged |
| Canonical race delivery emulator tests | 94 passed, including Facebook owner/creator wins, concurrent delivery, grant/acknowledgement failures and retry backoff |
| Core event aggregate test | 14 passed; small test-only clone fix restores framework-neutral Core type checking |
| Six isolated target builds | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo passed, including artifact/locale boundaries; GameSnacks also built |
| Devvit package | Package types, server tests and isolated package contract passed |
| Facebook injected browser | Result sharing, native cancellation/retry, authenticated/App Check token issuing, profile invitation, existing gameplay/lifecycle and prompt/ad ordering passed |
| Jest gameplay browsers | Four suites / 15 tests passed initially; the remaining gameplay test passed on isolated rerun |
| Jest targeted authentication/referral browsers | 4 passed, 58 unrelated scenarios skipped; includes existing registered launch, referral reward, race sharing/reminder and opaque invitation entry |
| Reddit injected browser | Passed |
| YouTube and standalone browsers | YouTube 10 and Netflix/Yahoo 2 passed |
| Source verification | Types, backend lint/build, TSDoc, file size, monetization, scalability and visible copy passed |

The first emulator run rejected three newly added test fixtures that wrote an
undefined deadline on already-completed runs; the fixtures were corrected and the
94-test rerun passed. The first Facebook browser run used an incorrect test-only
fanfare selector; the corrected native-sharing browser passed. A timing-sensitive
Jest safety busy-state assertion failed while browser suites ran in parallel and
passed when that gameplay test ran alone. Initial failure logs and reruns are kept;
these are not claimed as a failure-free single aggregate run.

The complete race coverage run passed: 72 suites / 1,015 tests, with 97.16%
line coverage. Release script checks (128), Facebook secret/profile/commerce
boundaries, and the supported Functions Node 22 runtime check also passed.
Injected SDKs and emulator transactions prove local behavior only.

## Local package and remaining gates

The [new local Facebook ZIP manifest](../../../artifacts/facebook-sharing-review-2026-10-01/manifest.json)
records its exact hash, size, files, dirty source HEAD and selected source hashes.
This includes the concurrent multiplayer work present in the shared checkout.
It is a testing/review copy with `uploadEligible: false`; a clean reviewed commit
and the existing canonical release gates are still required.

- Meta's configured MCP is registered, but OAuth still fails with
  `invalid_client_metadata` because dynamic registration is unavailable for this
  client. No authenticated Meta MCP/Instant Games management tools are claimed.
  The official Devvit MCP is installed and documentation search was verified in
  the preceding evidence.
- Facebook purchases remain unexposed pending valid payment setup, sanitized v8
  purchase/refund fixtures, a verified public grant/webhook boundary, and hosted
  purchase/recovery acceptance. Client adapters do not substitute for that proof.
- Native rewarded video is implemented behind age/config/API gates. Reward coins
  remain unavailable without a provider-verifiable server receipt/callback contract.
  Audience Network approval and live ad/device acceptance remain outstanding.
- Bot subscription prompts now use the real eligible-player SDK APIs after an
  authoritative win. Reminder delivery remains unavailable: Meta has no activated
  templates, and individual scheduling/cancellation has no implemented contract.
  Existing draft copy has not been activated or sent.
- Hosted native share/deep-link acceptance is still required for new/existing
  players, both race roles, reward cap cases, provider cancellation and account
  deletion on actual supported surfaces. Emulator/local SDK fixtures are not
  platform approval, physical-device or deployed-backend evidence.
- Reddit still requires owner access to Developer Settings, approval for the fixed
  fetch host, real contract fixtures and signed hosted acceptance before promotion.
