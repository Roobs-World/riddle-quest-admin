# Riddle Quest for Reddit

Solve word riddles directly in an interactive Reddit post. Read the clue, enter
your answer, and use the letter feedback to narrow down your next guess. You have
five attempts to solve each riddle.

## How to play

1. Open a Riddle Quest post and select **Play** to expand the game.
2. Read the riddle and submit a word. Letter feedback distinguishes the correct
   position, a letter elsewhere in the answer, and a letter absent from the answer.
3. Use that feedback for your remaining guesses.

Logged-out players can try local classic play. Guest progress stays on the device;
coins, purchases, daily challenges, leaderboards, and multiplayer are unavailable.
Log in through Reddit to use a saved game account. Guest coins or purchases never
transfer because guest play does not grant them.

The game includes 16 interface languages, right-to-left layout for Arabic,
reduced-motion and high-contrast preferences. The Reddit version contains no ads.
Gold purchases appear only when server configuration and Reddit approval permit
them. Push notifications are not integrated and require Reddit's gated beta
approval before activation.

## Community setup

After installation or an upgrade, the app creates or reuses its game post.
Moderators can also select **Create Riddle Quest game** from the community menu
to open that post. The app reuses the installation's existing game post rather
than creating a new one each time the menu action runs.

The current release is a private playtest. Production review and publication are
still outstanding; installation availability is controlled by Reddit.

## Implementation and review notes

This package is the Devvit Web container for the Reddit target. The webview client is built by
`@riddle-quest/portal` into `dist-reddit` and staged as separate inline and expanded entry points. The
request-scoped server owns every `/api/*` call. Browser code must never contact Firebase or another
external origin directly.

Local builds do not prove Reddit approval. Upload, playtest, payment, fetch-domain, and physical-device
evidence belong in `docs/reddit-games-progress.html`.

## Fetch Domains

- `www.roobsworld.com` — The request-scoped Devvit server uses four fixed HTTPS
  gateway endpoints on this host to exchange trusted Reddit identity and access
  the existing global Firebase authority for player
  storage, gameplay, account deletion, purchases, referrals, races, moderation,
  and presence. The browser never contacts this host directly. Devvit Redis is
  installation-scoped and cannot safely replace the existing cross-platform,
  transactional account/economy authority.

### Requested exception and endpoint scope

This is a request for a limited-scope first-party backend exception. The exact
hostname above serves a fixed, signed gateway for this game project and is the
only external host configured in this Reddit package.

| Endpoint | Purpose |
| --- | --- |
| `exchangeRedditIdentity` | Validate the signed Reddit context and establish the game account/session and enabled capabilities. |
| `redditStorage` | Read, write, and clear that player's game preferences and stored player projection. |
| `redditGameplay` | Execute allowlisted gameplay, profile, economy, payment/refund, referral, race, and presence operations. Availability depends on server capability configuration. |
| `deleteRedditAccount` | Delete the player's game account through the account-generation and cleanup flow. |

The capability needed is a transactional account/economy authority shared across
Reddit installations and used by the existing game services. Devvit's
installation-scoped Redis is used for the installation's canonical post reference;
it is not the authority for balances, purchase receipts, or player progression.
This architectural requirement is the basis for the exception request. Reddit
must determine whether it qualifies under its HTTP Fetch Policy.

### Data sent and request controls

The Devvit server sends the app, installation, subreddit, post, and Reddit user
identifiers with the requested operation, issue time, random nonce, payload hash,
and an HMAC signature. Identity exchange can include the current user's Reddit
username and a validated Reddit-hosted avatar URL. Operation payloads contain
the relevant game preferences, gameplay inputs, or commerce/referral/race data.
These requests therefore transmit Reddit user data to the game's Firebase backend.

The browser calls only same-origin `/api/*` routes. It does not supply the trusted
Reddit identity, select an external destination, or receive the gateway signing
secret. The server constructs the fixed Firebase destinations and signs each
operation; the Firebase handlers validate assertions and replay constraints.
Purchase grants and refunds are server-authoritative and idempotent. Anonymous
sessions use isolated local classic play without an identity exchange.

### Current review status

On October 1, 2026, the private installation remains at `0.0.1.23`, which
calls the previously denied Cloud Functions hostname. This source version calls
`www.roobsworld.com`. Its public `/api/reddit-gateway/*` route now passes the
unsigned-request check, rejecting it with JSON `signature-required`. This proves
the proxy route is live; it does not prove authenticated forwarding or Reddit's
fetch approval. The owner browser receives 403 for Developer Settings, so the
current host's approval remains unverified.
Run `pnpm check:hosted-gateway` before a private playtest upload; it requires an
unsigned POST to receive the proxy's JSON `signature-required` response. A local
build or a new upload does not establish fetch approval or hosted availability.

## Policies

- Terms and conditions: https://roobsworld.com/riddle-quest/terms
- Privacy policy: https://roobsworld.com/privacy
- Data deletion requests: https://roobsworld.com/contact

Both URLs are saved in the Reddit app details, rechecked through the authenticated
app API on October 1, 2026. Both public pages return HTTP 200. The Privacy page now
covers the Reddit game's trusted context, Firebase processing, progress, Gold
receipts, and deletion; Terms describe Reddit Gold fulfillment and refunds.
Operational privacy claims and the requested fetch exception still need owner
and Reddit review.
A private playtest or upload must not be represented as policy approval.

The Reddit package owns a target-specific third-party notice generated from its production dependency
graph. `stage:client` replaces the portal notice with that file so the Jest/Facebook artifacts do not
carry Devvit's server dependency graph while the uploaded Reddit client remains fully attributed.
