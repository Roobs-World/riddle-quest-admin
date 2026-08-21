---
status: accepted
---

# Keep Firebase authoritative behind a Reddit Devvit gateway

Riddle Quest will ship Reddit as a separate Web Target inside a versioned Reddit App. The browser will call only the same-origin Devvit Gateway, which authenticates the Reddit Session and forwards a narrow operation allowlist to Firebase; Firebase remains authoritative for Global Game Accounts, progression, economy, races, referrals, purchases, and moderation. Reddit installation storage may hold installation/post configuration and disposable caches, but never canonical global game state. This preserves one authoritative game world without placing the Firebase browser SDK or provider secrets in Reddit's webview.

## Considered options

- A direct Firebase browser client was rejected because Reddit's webview network policy permits client requests only to its own origin and because it would bypass the trusted Reddit request context.
- A separate Reddit-only economy in installation-scoped storage was rejected because each subreddit installation is isolated and could not represent the game's global accounts, balances, or leaderboards.
- Treating Reddit as another static upload was rejected because the product is an interactive-post package with a request-scoped server, not a general static hosting target.

## Consequences

- Reddit's external-fetch approval is a release gate for the exact Firebase HTTPS destinations used by the gateway.
- Every authenticated Reddit operation incurs the gateway hop and must bind the app, installation, subreddit, post, user, operation, time, nonce, and request payload.
- Anonymous players receive isolated, non-economic solo play; login never migrates currency, purchases, or untrusted progression.
- Provider capabilities without an approved Reddit contract remain Capability Gaps and are hidden or fail closed. Initial release does not emulate ads, push notifications, friends, contexts, or provider tournaments.
- The first release is an unlisted app in the dedicated r/RiddleQuest Installation. Public directory promotion is a separate approval and evidence gate.
- If Reddit declines the narrowly scoped external-fetch request, this decision must be revisited rather than silently moving canonical economy data into installation storage.
