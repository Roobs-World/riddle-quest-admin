# Jest submission feedback fixes — 21 September 2026

Status: implemented and verified locally; not deployed or uploaded to Jest.

## Feedback coverage

| Feedback | Change |
| --- | --- |
| Let players try the game before signup | Onboarding ends after welcome and instructions. Automatic signup waits until the first authoritative win’s achievement and reward panels close; a guest can voluntarily choose Upgrade Account in Profile. Registration attribution now identifies that explicit profile action. |
| Solo phone keyboard too small | Increased phone key height from 32 to 48 CSS pixels, used the full available width, and reduced surrounding spacing on short screens. Browser checks require at least 44 rendered pixels at 390×844 and 320×568. |
| Purchase banner persists | Transient host notices expire after four seconds. Browser purchase journey verifies dismissal. |
| Sound covers riddle | Audio occupies a separate grid column; browser checks verify its bounds do not overlap the text. |
| Multiplayer skip disabled initially | Both the UI and authoritative engine allow immediate skip. The existing 45-second penalty and receipt/idempotency path remain. |
| Coins during battle | Removed the coin display from active gameplay and countdown. |
| Win panel text alignment | Centered mandatory win/reward headings, with symmetrical space for the close control on dismissible panels. |
| Loss looks celebratory | Removed the rays and decorative spinning background from out-of-attempts; used a muted panel and border. Darkened action text to pass contrast checks. |
| Redundant guesses-remaining copy | Removed it and its unused key from all 17 locales. The guess board remains. |
| Multiplayer board narrower, status on right | Status and horizontal progress bars now sit above the full-width board. |
| Jest profile | The profile panel receives Jest's SDK username/avatar through a display-only context. No changes to account identity, balance authority, or other targets' profile ownership. Missing profiles have a localized fallback. Provider-owned profiles no longer offer game-local identity editing. |
| Treasure chest text | Replaced visible text with a chest image, retaining the translated accessible label. |
| Hint resembles video ad | Replaced the camera glyph with a lightbulb. |
| Overlays and slow win transition | Restricted the global loading overlay to startup; retained operation input guards. Removed the artificial 180 ms host activity window. Authoritative solo rewards and multiplayer outcomes are delivered before optional profile/platform follow-up finishes. Multiplayer answer submission uses a non-interactive 4 px progress indicator instead of a full-screen spinner. |
| “Waiting for host wrapper” | Replaced with existing translated Loading text; removed the obsolete key from every locale. |
| Activity loading | Reuses activity results for 30 seconds within the mounted player session; keeps previous results visible while refreshing and invalidates on starting a race. A delayed Activity response updates data without navigating away from the player’s chosen tab. |
| Frozen “3 Loading” | Shows Loading without a countdown number until the server run is ready, then runs the uninterrupted countdown. |

## Verification

- Extended production preflight passed, including backend coverage (1,011 tests), security rules (54 tests), upload dry runs and a ten-minute low-end mobile soak. The subsequent loss-button contrast and delayed Activity navigation fixes were rebuilt across all six targets and checked in the gameplay browser suite.
- Portal unit suite: 128 suites, 765 tests passed (browser/deployed suites excluded by their normal environment gates).
- Authoritative race engine: 20 tests passed, including immediate skip with the full penalty.
- Injected Jest gameplay browser journey: passed, including phone sizing, sound separation, horizontal multiplayer status, initially enabled skip, purchase notice expiry, keyboard/IME input, rewards, out-of-attempts styling/contrast, delayed Activity navigation, accessibility and responsive layouts.
- Injected Jest authentication suite: 29 tests passed, including registered/guest states, checkout and recovery, profile failure fallback, and creator-to-recipient multiplayer. The added signup regression verifies guest input before any prompt and the automatic prompt after a confirmed win and reward collection; it also checks that multiplayer submission never covers the board.
- Injected Facebook, Reddit and YouTube browser suites: 1, 1 and 9 tests passed respectively.
- All six production target builds and artifact isolation audits passed: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. YouTube and Netflix used the release content checks, not the incomplete fixture bypass.
- Portal and Functions type checks, locale checks, declaration documentation audit, file-size audit and whitespace checks passed.

Reproductions before fixes: the browser measured 32 px solo keys; the component test rendered `3` while loading; the server test rejected immediate skip; a deferred optional follow-up prevented the win response from being delivered. Further reproductions found left-aligned mandatory win headings, a 667 px multiplayer submission overlay, delayed race outcomes during optional profile updates, and signup appearing over rewards. A delayed Activity response also reproduced an unwanted navigation back from Play; the browser regression now requires Play to remain selected when that response arrives. Regression checks pass for these fixes.

## Visual evidence

- [Victory reward panel](../../artifacts/jest-feedback-2026-09-21/victory.png)
- [Out-of-attempts panel](../../artifacts/jest-feedback-2026-09-21/loss.png)
- [Solo phone screen](../../artifacts/jest-feedback-2026-09-21/solo.png)
- [Multiplayer phone screen](../../artifacts/jest-feedback-2026-09-21/multiplayer.png)
- [Profile with absent provider profile](../../artifacts/jest-feedback-2026-09-21/profile-fallback.png)

## Release and live verification

Deploy the race-engine backend change with the client before resubmission; the old backend will still reject immediate skips. Purchase grants remain server-authoritative and idempotent. No Jest Developer Console changes are required for the profile presentation change.

The SDK profile handling follows [Jest's social profile documentation](https://docs.jest.com/sdk/social#user-profile): read after initialization and support null profile/avatar values. The adapter already fetched this data; the missing connection was its presentation in the profile panel.

Local injected harnesses establish UI behavior, not production network timings. Before resubmitting, check a real Jest account's name/avatar, a sandbox coin purchase, immediate skip against the deployed backend, and Activity/start/win transitions on a phone over a representative mobile connection. No claim is made that all live backend requests now finish within a specific latency budget.
