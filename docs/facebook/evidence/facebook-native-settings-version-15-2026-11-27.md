# Version 15 native Settings, saves and host layout — 27 November 2026

Developer-role desktop verification of **Riddle Quest**, app `1748953042991569`, exact Testing version **15**, bundle `30470981679157112`. The source is `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0`; archive SHA-256 is `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824`. The live Web Hosting row was rechecked and remained Testing, with SDK 8.0 NEZP; Production remained version 9. Relaunches used the Play link from that exact row. Private launch parameters are not retained here.

## Native legal-link cancellation

1. Opened Settings from the coconut puzzle with **920 coins** and Reduced motion **Off**.
2. Selected **Privacy Policy**. Meta's native **You're leaving Facebook** dialog named Riddle Quest and `https://roobsworld.com/riddle-quest/privacy`.
3. Selected **Go back**. Privacy Policy, Terms of Use and Quit game were enabled again.
4. Selected **Terms of Use**. The same native confirmation named `https://roobsworld.com/riddle-quest/terms`.
5. Selected **Go back**. All three controls were enabled again. Neither external link was followed.

## Preference persistence, quit and restoration

1. Changed Reduced motion from **Off** to **On**, then selected the game's **Quit game** action. The game iframe disappeared and Facebook's Games landing page appeared.
2. An immediate relaunch navigation timed out and remained on the Games page. After checking that state, read the exact version-15 row's Play link again and relaunched successfully. This was not a new upload.
3. Startup showed Loading 100%, then Preparing your game 88%, and briefly **Service temporarily unavailable. Please try again.** The coconut puzzle recovered without another reload. Settings then showed Reduced motion **On**; native Privacy and Quit actions were enabled. No failed request/status trace was captured, so the underlying service cause is unproven.
4. Restored Reduced motion to **Off**. Quit again, waited for the Games landing page and absence of the game iframe, and relaunched the same candidate.
5. The second relaunch restored the coconut puzzle and **920 coins**. Settings showed Reduced motion **Off**, with Privacy and Quit enabled. Closed Settings; Settings and the first answer cell remained enabled.

This establishes visible same-account persistence across native quit/relaunch and restoration of the original preference. It does not independently trace each save/flush SDK method or establish cross-device/account persistence. The first relaunch's transient error remains part of the observed outcome; startup was not uniformly error-free.

A read-only source trace found that this recovery is intentional: [useHostRiddleLifecycle](../../../src/gameplay/hooks/browser/useHostRiddleLifecycle.ts) reports failed owned delivery, exposes Settings and retries the current account/mode/locale/index with backoff; successful recovery clears the failure. [riddleLoadDeadline](../../../src/gameplay/browser/questions/riddleLoadDeadline.ts) bounds each wait at 15 seconds and ignores its late settlement. The visible message alone cannot distinguish a deadline, authentication failure or upstream rejection, so this observation neither proves a client defect nor proves the original failed request later supplied the puzzle. These source files are unchanged from the version-15 commit. No speculative source fix or backend change was made.

## Desktop host display mode

The host's **Collapse** action exposed **Expand**; **Expand** restored the sidebar and **Collapse**. The game's rendered `data-facebook-display-mode` changed **normal → expanded → normal**. Settings, Multiplayer and the first answer cell remained enabled. Settings stayed within the game viewport; its frame remained 430 × 765 in both observed sidebar states. This verifies the visible desktop display-mode path, not a real mobile-host journey or independent invocation tracing of every SDK method.

## Scope

These are additional **H15** observations for J01/J02/J04, separate from the [inactive-banner observation](facebook-native-banner-version-15-2026-11-27.md). No native banner load/hide, mobile capability, purchase, account replacement, subscriber suppression, social send or participant join was verified. No SDK replacement, network fixtures or runtime patching was used. No Firebase source, configuration or deployment changed. No new build/upload, provider setting change, production promotion or review submission was made. The original Reduced motion preference, puzzle and balance were preserved at the end.
