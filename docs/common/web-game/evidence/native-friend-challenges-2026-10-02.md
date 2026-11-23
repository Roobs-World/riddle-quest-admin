# Native friend challenges — 2026-10-02

The multiplayer intro exposes **Challenge a friend** when the active target supplies both private lobby transport and native invitation sharing. Jest uses its existing SDK referral share dialog, including the host's SMS option. Facebook now supplies `shareChallenge` through its multiplayer adapter independently of the referral rewards setting.

Facebook prefers `inviteAsync` when both advertised and callable. Hosts supporting only `shareAsync` use the native `CHALLENGE` dialog with `switchContext: false`. Neither API is exposed on unsupported hosts. The existing authenticated multiplayer and verified audience gates still apply.

Both Facebook paths send only the opaque server lobby handle in entry data. Live challenges no longer require a referral token request. Cancellation preserves the reserved lobby; provider failures allow retry, and the shared SDK dialog gate prevents overlapping prompts. Closing the dialog never counts as recipient acceptance. Incoming launches show the existing multiplayer invitation card and require explicit acceptance into the original lobby.

The current Meta contract was checked against [Custom Updates, Invites, and Shares](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/custom-updates-invites-shares). Jest behavior follows [HTML5 referrals](https://docs.jest.com/sdk/html5/referrals).

Validation:

- 18 Facebook invitation/referral unit tests passed, covering native picker preference, share fallback, bounded payloads, malformed handles/images, disabled or unsupported capabilities, cancellation, retry, account retirement and overlapping dialogs.
- The injected browser harness passed at 390×844 and 1280×900 for Jest, Facebook friend picker, and Facebook share fallback. Facebook deliberately had no referral sharing capability. Each path verified private lobby reservation, cancelled/failed dialog retry, incoming notification, no automatic acceptance, acceptance into the same lobby, countdown and gameplay. Existing direct invitation inbox and push permission controls also passed. Unsupported Facebook invitation hosts omitted the action.
- Core and Functions builds and portal type checks passed. All isolated targets built successfully: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo and the repository's additional GameSnacks target. Available locale and artifact boundary audits passed.

Browser captures are in `artifacts/live-pvp-invitations/browser/`. SDK dialogs were injected; these checks did not send real invitations, notifications, or deploy production changes.
