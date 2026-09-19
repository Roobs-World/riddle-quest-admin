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

The game includes 17 interface languages, right-to-left layout for Arabic,
reduced-motion and high-contrast preferences. The Reddit version contains no ads.
Purchases and notifications remain unavailable unless their platform approvals and
server configuration enable them.

## Community setup

After installation or an upgrade, the app creates or reuses its game post.
Moderators can also select **Create Riddle Quest game** from the community menu
to open that post. The app reuses the installation's existing game post rather
than creating a new one each time the menu action runs.

The current release is a private playtest. Production review and publication are
still outstanding; installation availability is controlled by Reddit.

## Implementation and review notes

This package is the Devvit Web container for the Reddit target. The webview client is built by
`@qwordly/portal` into `dist-reddit` and staged as separate inline and expanded entry points. The
request-scoped server owns every `/api/*` call. Browser code must never contact Firebase or another
external origin directly.

Local builds do not prove Reddit approval. Upload, playtest, payment, fetch-domain, and physical-device
evidence belong in `docs/reddit-games-progress.html`.

## Fetch Domains

- `us-central1-riddle-quest-ec2b2.cloudfunctions.net` — The request-scoped
  Devvit server uses four fixed HTTPS endpoints on this host to exchange trusted
  Reddit identity and access the existing global Firebase authority for player
  storage, gameplay, account deletion, purchases, referrals, races, moderation,
  and presence. The browser never contacts this host directly. Devvit Redis is
  installation-scoped and cannot safely replace the existing cross-platform,
  transactional account/economy authority.

## Policies

- Terms and conditions: https://roobsworld.com/riddle-quest/terms
- Privacy policy: https://roobsworld.com/privacy
- Data deletion requests: https://roobsworld.com/contact

The game Terms page is published. Production review remains blocked until its
URL and a Privacy Policy covering the Reddit game are added to the Reddit app
details. The currently linked Privacy page describes website account
and analytics processing; its coverage of the game still needs owner review.
A private playtest or upload must not be represented as policy approval.

The Reddit package owns a target-specific third-party notice generated from its production dependency
graph. `stage:client` replaces the portal notice with that file so the Jest/Facebook artifacts do not
carry Devvit's server dependency graph while the uploaded Reddit client remains fully attributed.
