# Reddit fetch reconsideration preparation — 2026-09-20

Status: local preparation only. Not submitted, not approved, and not a fix to
hosted availability. The available browser receives a logged-out 403 for the
app's Developer Settings. The owner has been asked for the exact rejection text;
the authenticated API returns a denial status but no reason.

## Verified and corrected

- `devvit.json` already requests the exact deployed hostname, with no protocol,
  wildcard, or path. No hostname configuration change is indicated.
- The authenticated app API still reports `DENIED` for
  `us-central1-riddle-quest-ec2b2.cloudfunctions.net`; last update is
  `2026-08-21T19:53:24.204Z`.
- Terms and Privacy URLs are already set in app metadata. Both return HTTP 200.
- The package README now lists the four endpoints, data transmitted, request
  controls, capability justification, and actual review status. It no longer
  incorrectly says the policy URLs still need to be added to app metadata.
- The live Privacy page describes website sign-in, security, and optional
  analytics. It does not explain the Reddit game's processing. This is a
  documentation gap, not a confirmed reason for Reddit's denial.

## Policy constraint

Reddit's [HTTP Fetch Policy](https://developers.reddit.com/docs/capabilities/server/http-fetch-policy)
requires limited-scope cloud-provider exceptions to demonstrate a capability
Devvit does not support and satisfy privacy/data-governance requirements. Its
examples do not automatically approve this Cloud Functions hostname or the
game's global account/economy design. Reddit must assess that justification.

The existing repository architecture requires Firebase as the global authority.
Changing domains, adding a proxy, or putting the Firebase SDK in the browser does
not address the policy question. Moving canonical balances and progress to Devvit
Redis would change that architecture and conflict with repository instructions.

## Draft reconsideration message

Do not send until the actual rejection reason has been incorporated and the
public game privacy notice is complete. No message has been sent by this run.

> App: riddle-quest
>
> Please reconsider the denied HTTP Fetch request for
> us-central1-riddle-quest-ec2b2.cloudfunctions.net, or identify which requirement
> prevents approval of this architecture.
>
> This is the exact Firebase Functions host for Riddle Quest. We request a
> limited-scope exception for the game's transactional account/economy authority
> shared across Reddit installations and used by the existing game services.
> Installation-scoped Redis holds the game-post reference, not authoritative
> balances, purchase receipts, or player progression.
>
> Only our Devvit server contacts the host. It calls four fixed endpoints:
> exchangeRedditIdentity, redditStorage, redditGameplay, and deleteRedditAccount.
> The webview uses same-origin /api/* routes and contains no Firebase browser SDK.
> Requests carry signed, operation-scoped Reddit identity/context and the game
> payload. Identity exchange can include the current Reddit username and a
> validated avatar URL. We do transmit Reddit user data to Firebase; the package
> README documents the endpoint scope and data flow.
>
> Purchase grants and refunds remain server-authoritative and idempotent. The
> denied host currently prevents authenticated play in the private test
> community. Please confirm whether the shared transactional authority qualifies
> for an exception and what additional evidence is needed.

## Remaining inputs before submission

1. Exact reviewer explanation from Developer Settings or the rejection message.
2. A published privacy notice covering the game's actual Reddit/Firebase data
   processing, including applicable retention and deletion exceptions. The
   [engineering inventory](../privacy-data-inventory.md) provides source-backed
   details and identifies operational facts that must not be invented.
3. Upload the corrected README with the next private candidate using the existing
   release workflow, and request reconsideration through Reddit's review/support
   channel. Repeated uploads are not evidence that a denied request reopens.
4. After approval, verify authenticated hosted session, storage, gameplay, and
   save flows. Local harness results cannot replace that check.
