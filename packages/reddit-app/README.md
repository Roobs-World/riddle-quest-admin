# Riddle Quest for Reddit

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

- Privacy policy: https://roobsworld.com/privacy
- Data deletion requests: https://roobsworld.com/contact

Production review remains blocked until an owner-approved public Terms and
Conditions URL is added to the Reddit app details. A private playtest or upload
must not be represented as policy approval.

The Reddit package owns a target-specific third-party notice generated from its production dependency
graph. `stage:client` replaces the portal notice with that file so the Jest/Facebook artifacts do not
carry Devvit's server dependency graph while the uploaded Reddit client remains fully attributed.
