# Facebook and Reddit review preparation — 1 October 2026

Status: meaningful local progress; the full review-readiness goal remains active.
Neither platform is approved or ready for public promotion. No provider upload,
backend deployment, review submission, notification send, or payment was performed.
Existing concurrent multiplayer changes were preserved.

## Current provider evidence

The official [Devvit MCP](https://developers.reddit.com/docs/guides/ai) is registered
as `devvit` using pinned `@devvit/mcp@0.0.27`. A real stdio MCP initialization,
tool listing, and documentation search succeeded. The exposed tools are
`devvit_search` and `devvit_logs`. Search confirmed the current provider lifecycle
guidance: read `getWebViewMode()` on window focus when returning from expanded play.
The log request did not complete, and a bounded CLI log stream returned no usable
historical entries. This is not evidence of an error-free hosted installation.
Probe processes were stopped after inspection; other sessions were preserved.

Meta's `facebook` Ads MCP remains registered but unauthenticated after the OAuth
registration rejection recorded in [the Facebook SDK follow-up](../../../facebook/evidence/facebook-sdk-followup-2026-10-01.md).
It does not provide an Instant Games developer-console transport.

Rechecked Reddit through authenticated Devvit CLI, the public website, the available
browser, and the existing Firebase MCP:

- The private test-community installation is still `0.0.1.23`. Its uploaded README
  still requests the previously denied Cloud Functions host. Current source requests
  only the fixed first-party `www.roobsworld.com` proxy.
- `check:hosted-gateway` now **passes**: the live proxy rejects unsigned requests with
  JSON `signature-required`. This supersedes the earlier finding that the website
  route was absent. It does not prove signed forwarding, Devvit access, or approval.
- The linked Privacy and Terms pages both return HTTP 200. Privacy now describes
  Reddit context, Firebase processing, progress, Gold receipts, and deletion. Terms
  describe Reddit Gold fulfillment/refunds. Owner review of operational claims and
  Reddit policy approval remain separate gates.
- Developer Settings returns **403** in the available owner browser. Approval for
  `www.roobsworld.com` remains unverified. No denial reason or approval was invented.
- Firebase MCP lists all four Reddit gateway Functions in `us-central1`. Presence of
  deployed names is not proof of matching source revisions, secrets, or signed calls.

The [HTTP Fetch policy](https://developers.reddit.com/docs/capabilities/http-fetch)
requires approval for the exact requested hostname and permits browser requests only
under same-origin `/api/*`. A personal-domain exception requires justification; a
working proxy does not grant that exception. [Reddit push notifications](https://developers.reddit.com/docs/capabilities/notifications/notifications-overview)
remain a gated beta requiring Reddit acceptance. No notification SDK was substituted
with Jest scheduling or an unapproved delivery mechanism.

## Local changes

Reddit now re-reads the real Devvit SDK mode on focus. Collapsing expanded play while
document visibility stays visible returns to the inline presentation, pauses the
shared game through the Reddit lifecycle adapter, and disconnects expanded-session
presence. Reopening expanded mode restores the game. Listener cleanup is verified.

Presence revocation now waits for a pending server poll before disabling or
disconnecting its lease. A generation check prevents stale responses from restoring
rivals or polling timers after opt-out, backgrounding, or teardown. Revocation writes
also serialize with a newer opt-in so a late old disable cannot overwrite the new
consent. The existing 10-second hub and 2-second race budgets remain unchanged.

The Reddit browser fixture now uses an ephemeral port and can use
`PORTAL_REDDIT_BUILD_DIR`. Its initial run collided with another process's fixed
4182 port and timed out; the isolated rerun passed. This addresses test interference
without stopping other work or changing a production network policy.

The package README now correctly states 16 supported interface locales and current
policy/proxy observations. The [Reddit operations runbook](../../../reddit/reddit-games-operations.md)
links this evidence. No new visible game strings were introduced.

## API coverage and remaining requirements

| Requirement | Current implementation/evidence | Remaining work |
| --- | --- | --- |
| Facebook identity, cloud preferences, locale and lifecycle | Real FBInstant v8 adapter, signed backend exchange, SDK storage, pause/resume; local browser passed | Exact uploaded build and physical-device acceptance |
| Facebook notifications and ads | Real bot subscription APIs, authoritative win prompt lease, verified public ad placements, shared dialog guard; local browser passed | Meta reminder activation, hosted consent/ad/delivery evidence; rewarded grant verification |
| Facebook purchases | Catalog and recovery parsing prepared; server-authoritative internal ledger; runtime exposure disabled | Valid payment account, sanitized receipt/refund contracts, public verifier and recovery acceptance |
| Facebook native contexts and profile overlays | Real SDK context selection/matching and provider overlays; local browser coverage retained | Hosted multi-account/context/device evidence |
| Facebook referrals and outbound sharing | Native SDK shares and incoming challenge routing now wired; multiplayer establishment and first-win gaps resolved in the [subsequent evidence](../../../facebook/evidence/facebook-native-sharing-2026-10-01.md) | Hosted share/deep-link acceptance with new/existing players, cap cases and physical devices |
| Reddit identity, login, expansion, posts and Gold checkout | Real Devvit request context, client login/expansion APIs, moderator/install post APIs and payment APIs; authoritative gateway | New private candidate, exact-host approval, signed hosted journeys and real payment/refund fixtures |
| Reddit storage and social activity | Same-origin gateway; global Firebase authority; bounded lease presence with lifecycle cleanup | Hosted acceptance and role coverage; no provider friends/realtime/notification contract is fabricated |
| Platform isolation | All six required targets plus GameSnacks built with artifact audits; Reddit package contract and browser checks passed | Repeat after later code changes and bind final reviewed source to release bytes |
| Review handoff | Two local ZIPs and provider-check summary retained | Clean reviewed commit, provider ingestion/evidence gates, IARC/payout/policy approvals, physical web/iOS/Android checks |

This table preserves the full objective. The goal is not complete merely because
local tests pass. The subsequent native-sharing changes have separate validation
and a newer local Facebook review package; hosted review, contract, and device
evidence are still incomplete. The ZIPs below preserve the earlier snapshot.

## Verification

Logs: [validation directory](../../../../artifacts/facebook-reddit-review-2026-10-01/validation/).

| Check | Result |
| --- | --- |
| Portal unit tests | 167 suites / 1,412 tests passed; 95 opt-in tests skipped |
| Reddit adapter tests | 33 passed, including pending poll revocation and provider focus lifecycle |
| All target builds | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, GameSnacks passed; SDK/artifact boundaries passed |
| Devvit package | Server types, 31 tests and package contract passed; isolated inline/game client and CJS server |
| Reddit injected browser | 1 passed, including focus collapse/disconnect/reopen and existing locale, auth, gameplay, commerce-free and recovery cases |
| Facebook injected browser | 1 passed, retaining real SDK contract, prompt/ad ordering, immediate feedback and lifecycle coverage |
| Jest gameplay browser | 5 suites / 16 tests passed against immutable Jest build |
| Jest authentication browser | 62 tests passed against immutable Jest build |
| YouTube and standalone browsers | YouTube 10, Netflix/Yahoo 2 passed |
| Release scripts | 128 passed |
| Source checks | Types, TSDoc, file-size, documentation, monetization, and whitespace passed |
| Reddit hosted contract gate | Correctly fails: all six real provenance-bound fixture types absent |
| Reddit hosted acceptance gate | Correctly fails: hosted evidence manifest absent |

Injected fixtures prove local behavior only. They do not establish Meta/Reddit
approval, physical-device behavior, real receipt verification, or an authenticated
Devvit-to-Firebase request.

## Local review packages

The [manifest](../../../../artifacts/facebook-reddit-review-2026-10-01/manifest.json) records
source HEAD `8dc08e65f3a72f964137e68eff70487eb7bbf700`, the dirty/concurrent working
tree, sizes, and exact hashes. **Both packages have `uploadEligible: false`.** They
are inspection/testing copies, not clean-source production or upload handoffs.

- [Facebook local ZIP](../../../../artifacts/facebook-reddit-review-2026-10-01/riddle-quest-facebook-local-review.zip):
  `dd49cb7c5e5fbd9d0e9f641503b8670334de0bfb33baca15e4949807c0ddfcf3`,
  2,758,465 bytes / 400 regular files; root game/config verified.
- [Reddit local ZIP](../../../../artifacts/facebook-reddit-review-2026-10-01/riddle-quest-reddit-local-review.zip):
  `02ec05ab3ed2fba6fae3e961c9a11719c33eb26997951236f340c8dc13a483f0`,
  3,141,145 bytes / 418 regular files; Devvit config, inline/game entries and CJS
  server verified. This is not claimed to be a Devvit CLI upload format.
- [Provider-check summary](../../../../artifacts/facebook-reddit-review-2026-10-01/provider-checks.json)
  contains only bounded configuration/status evidence. Raw app metadata, tokens,
  signatures, user IDs, and provider credentials were not copied into evidence.

Canonical releases must use each target's existing clean-source, exact-byte gates.
Keep the goal active while code gaps and real review acceptance remain unresolved.
