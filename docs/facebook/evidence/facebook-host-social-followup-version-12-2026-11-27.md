# Riddle Quest desktop display and social follow-up — version 12

Observed on 27 November 2026 using the existing developer-role account in the real Facebook desktop Chrome host, English locale. This continues the [earlier native follow-up](facebook-native-followup-version-12-2026-11-27.md) on the same immutable Testing candidate. No source change, rebuild, re-upload, SDK replacement or injected native result was used.

## Candidate identity

- Game / app: Riddle Quest / `1748953042991569`.
- Testing version / bundle: **12** / `29781063778191740`.
- Source: `8e3b7d2ef942ea387e7370c23ff4f1c1448fa108`.
- Archive SHA-256: `a2780de4ed9ac7856f447b4f19d6d7940c0b5067ba87c2436b4fcab524ddac28`.
- [Accepted archive record](facebook-testing-version-12-2026-11-27.json): 2,864,259 bytes. Production remains version 9.

## Native display mode

The game's HTML root initially exposed `data-facebook-display-mode="normal"`. Selecting Facebook's native **Collapse** control hid its side panel and changed the game's attribute to `expanded`; Multiplayer remained enabled. Selecting the host's **Expand** control reopened the panel, restored the game attribute to `normal`, and left Multiplayer enabled.

The canonical [host adapter](../../../platforms/web/facebook/src/engagement/FacebookHostEnvironment.ts) maps the native display getter/callback to this attribute and dispatches the existing resize signal. These observations establish a real host-driven mode round trip through the game's observable adapter output. They are not an independent trace of each callback, an overlay remeasurement proof, or fullscreen/mobile acceptance. No viewport emulation was used, and the original host layout was restored.

## Terms cancellation

Settings → **Terms of Use** opened Meta's **You're leaving Facebook** prompt showing `https://roobsworld.com/riddle-quest/terms`. Selecting **Go back** restored enabled Terms of Use and Quit game controls. Closing Settings returned to usable gameplay with 885 coins. This complements the earlier privacy-link cancellation; the external terms page was not opened by this check.

The Settings view did not offer Follow our page or Join our group in this session. The host already displayed Following for Riddle Quest. No follow/group action was attempted, and absence alone does not establish the precise eligibility or association reason.

## Result share cancellation

Completed the next Classic puzzle, HAMSTER, through the visible keyboard and Submit control. The accepted result showed the ordinary **+35 Coins** payout, taking the balance from 885 to 920. After the result's Share control became available, selecting it opened Meta's **Share game** composer with Riddle Quest result text.

Selected **Close composer dialogue** without changing the audience or choosing any feed, Messenger, group, or copy-link action. The native composer disappeared; the game's Share control was enabled again, and the result still showed +35 Coins and 920 coins. Next Level returned to normal Classic gameplay with Multiplayer enabled.

This verifies native result-share presentation and cancellation recovery. No post or message was sent. It does not establish delivery, recipient entry, the opaque payload's contents or any referral reward.

## Social discovery and chooser recovery

Opened Multiplayer → Race to 10 → **Play on Facebook**. After discovery settled, the panel displayed **Friends who play: 0** and an empty Facebook tournaments list. These are account-specific observations, not proof of matching, tournament joining or Room eligibility.

Selected **Choose friends** once. No successful picker was observed. The game displayed **Service temporarily unavailable. Please try again.** and removed that action. Refresh cleared the failure notice while keeping Choose friends absent; **Play with friends** remained enabled. This reproduces action retirement on exact version 12. No new raw SDK error was captured here, so the precise rejection code is not independently established by this follow-up; version 11's recorded unsupported-overload result remains a separate observation.

Selected the separate **Play with friends** action. Facebook opened its native context chooser. Closed it without selecting a person or context. The game restored enabled Play with friends and Start PvP match controls. Closing Race to 10 returned to Classic with Multiplayer enabled, 920 coins, and normal display mode. No invitation, challenge, match or tournament was created by these checks.

## Limits and preserved state

The only additional game progression was the single normal Classic win; its 35 coins were unrelated to sharing. The prior 885-coin observation remains historical evidence from the earlier follow-up, not the final balance for this later session. The game was left ready on its next Classic puzzle.

No Firebase code, configuration or provider server module was edited, and no backend deployment occurred. No permission, community membership, notification consent, purchase, deletion, review submission, Production promotion or app association was changed.

The [role-access query](facebook-role-access-followup-2026-11-27.json) explicitly confirms BASIC standard access for app-role users and absent advanced access. These checks therefore do not prove public availability. The [API checklist](../facebook-api-submission-checklist-2026-11-27.md) still retains six implementation gaps, eleven conditional entries, native mobile work and provider/review prerequisites.

## Later lifecycle observation limit

A further observation on the same candidate read the existing DOM while opening and cancelling the native Terms prompt. Before and during that prompt, the game document remained `visible`, the main element remained `game-app` without its `paused` class or pause banner, and music remained playing with advancing time. This native dialog therefore did not exercise an observable game pause; it is not acceptance evidence for `onPause` or `onResume`.

A subsequent tab-fronting attempt also did not yield an observed hidden game document. No artificial visibility event, SDK replacement or lifecycle callback was injected to turn that attempt into a pass. The game was restored to the foreground, ready at 920 coins.

The existing [host lifecycle bridge](../../../src/platform/bridge/browser/useHostBridgeLifecycle.ts) maps browser visibility and platform callbacks to the same pause state. Even a successful ordinary background/return check would establish combined recovery without independently identifying the native callback source. Native pause/resume, save-drain and mobile-host acceptance remain open.
