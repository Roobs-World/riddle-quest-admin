# Riddle Quest native follow-up — Testing version 12

Observed on 27 November 2026 in Facebook's real desktop Chrome host using the existing developer-role account, English locale and the exact Testing Play link. These checks used the rendered game and native Facebook surfaces, with no replacement SDK or injected native-result fixtures. This is a record of observed UI behavior, not an independent trace of every SDK call or backend operation.

## Exact candidate

| Field | Value |
| --- | --- |
| Game | Riddle Quest |
| Meta app | `1748953042991569` |
| Testing version / bundle | `12` / `29781063778191740` |
| Source | `8e3b7d2ef942ea387e7370c23ff4f1c1448fa108` |
| Archive SHA-256 | `a2780de4ed9ac7856f447b4f19d6d7940c0b5067ba87c2436b4fcab524ddac28` |
| Archive size | 2,864,259 bytes |
| Production | Version 9; no promotion performed |

The [acceptance record](facebook-testing-version-12-2026-11-27.json) contains the exact upload identity. The [client review](facebook-client-review-2026-11-27.md) records the earlier real rewarded completion, continuation with unchanged coins, and privacy-link cancellation on these same candidate bytes. No new archive was built or uploaded for this follow-up.

## Save, native quit and relaunch

1. Opened Settings and changed **Reduced motion** from Off to On.
2. Immediately selected **Quit game**. Facebook removed the game iframe and returned to its `/gaming/play/` surface.
3. Relaunched the same Testing version through its Meta Hosting Play link. Settings showed Reduced motion On.
4. Restored Reduced motion to Off, quit and relaunched again. Settings showed Off.

This establishes the observed preference round trip across native quit/relaunch, including restoration of the original preference. It does not establish account separation, failed-save handling, offline durability or backend revision. A URL wait using an exact URL did time out because the exit URL included a query; the subsequently observed path and absent game iframe confirmed that quit itself succeeded.

An earlier attempt used Sound as the persistence probe. Sound returned to On after relaunch. Source inspection and the existing [full user-pathway evidence](../../common/web-game/evidence/full-user-pathways-e2e-2026-10-01.md) establish that enabling sound on a new session is intentional existing policy. The Facebook browser harness also expects Sound On after restoring `muted: true`. No save defect or Firebase change was inferred from that behavior, and no audio code was changed.

## Shortcut cancellation

Settings → **Add to home screen** opened Meta's **Save to Your games** prompt. Selecting **Cancel saving Riddle Quest to your games** returned to the game. The shortcut action was then absent for the current SDK session and Quit game remained enabled. No shortcut was created. This covers cancellation and the one-attempt session behavior; successful shortcut creation was not exercised.

## Real interstitial display and recovery

Completed six unique Classic levels through the visible game controls: PENGUIN, SNAIL, PIANO, BEAVER, CANDLE and ZIPPER. On the third win, Next Level was selected immediately and no ad was observed. Read-only source review confirmed that leaving the result retires that result's ad opportunity; an already dismissed result must not cause a late interstitial.

On the sixth win, the victory screen was left open. A real Meta-served interstitial appeared. **Close Ad** returned to Riddle Quest's victory screen with its ordinary **+55 Coins** level reward. **Next Level** then opened the next Classic puzzle and gameplay remained usable. No advertiser destination was opened.

Normal gameplay moved the balance from 625 to 885 coins across these six wins. This is gameplay progression, not an ad coin grant. Together with the earlier rewarded observation, both native ad formats have now displayed and returned control on version 12. Subscriber suppression, entitlement changes, no-fill, native early cancellation, cooldown/session-cap boundaries and mobile support are not certified by this single interstitial observation; controlled local coverage is documented separately in the client review.

## Invitation cancellation

Profile → **Invite a friend** opened Meta's native invitation surface with the Riddle Quest card. No recipient was selected and no send action was taken. Closing the native surface restored the game's invitation control. Closing Profile then returned to gameplay; the native invitation and Profile dialogs were absent, and Multiplayer was enabled. The balance remained 885 coins.

This establishes native invitation presentation and cancellation recovery only. It is not invitation delivery, referral acceptance, recipient-side entry or reward evidence.

## Scope and remaining work

The final observed game was ready in Classic mode with the next puzzle open. Reduced motion was restored to Off and Sound was On. No purchase, message, notification subscription, account deletion, association with another app, permission expansion, review submission or publication was performed.

Firebase Functions, configuration and provider server files remain unchanged from the protected baseline `2834dc910a39aa9add734440ddfb8dfd533d30dc`; no Firebase deployment or configuration mutation was performed in this work. Historical ad setup rollouts documented earlier on 27 November predate this thread and were not reverted. Authorized gameplay naturally updated the test account's progress and preferences; this record does not claim account data stayed unchanged.

The [79-entry API checklist](../facebook-api-submission-checklist-2026-11-27.md) retains six integration gaps, eleven conditional entries, approval prerequisites and unsupported-host work. These desktop developer-role observations do not establish public access or supported mobile behavior. Current reviewer steps are in the [November handoff](../facebook-review-draft-2026-11-27.md).
