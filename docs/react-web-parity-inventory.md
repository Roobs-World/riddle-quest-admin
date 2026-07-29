# Riddle Quest React Web Parity Inventory

## Scope and reference

This is the acceptance inventory for the standard React conversion of the former React Native Android game. The immutable reference is Git commit `2adbaa0a2f3aeb856443baa97d656d9ff338a264` (874 files under `src`, 67 assets and 55 Firebase Function source files). Git history remains the archive; obsolete native source is deliberately not retained in the working tree.

The only intentional product deviations are required Jest platform substitutions. They are listed below. Ads, haptics, external authentication, native IAP, Android/iOS packaging, Expo/EAS, the admin portal and migration UI are not web features.

## Player-facing page and overlay matrix

| Former React Native surface | React web implementation | Acceptance |
|---|---|---|
| `LandingScreen`, `LanguageSelectionScreen`, `NavigationStack` | Jest session boot in `JestPlayApp`; game opens directly; language selection persists in Settings | Platform player identity is established before play; all 17 languages remain selectable |
| `GameScreen`, `GameBoard`, `Header`, `Controls`, `BottomNavigationBar` | `GameFrameApp`, `GameHeader`, `GuessBoard`, `Keyboard` | Classic/daily selection, balance, mute, profile/settings, riddle, grid, custom input and actions |
| `SolarSystem3D`, `StarryBackground`, solar service stages | Lazy `SolarSystem` using Three.js | Sun/corona, seven planets, five moon textures, Earth/Saturn rings, lighting, camera, stars, orbit/rotation and lifecycle pause |
| `WelcomeModal`, `GuestOnboardingModal`, `InstructionsModal` | `GuidanceOverlay` and `instructions` modal | Returning two-step flow and unregistered Jest-player three-step welcome/rules/registration flow |
| All `TooltipOverlay` sequences and contextual callouts | `GuidanceOverlay` | Game tour, profile tour, wrong-guess hint, out-of-coins, achievement, fifth-win leaderboard and daily-to-classic guidance with per-player completion flags |
| `VictoryModal`, `AchievementUnlockFanfareModal`, `LevelUpFanfareModal`, `RankUpFanfareModal` | Authoritative victory fanfare sequence in `GameModalView` | One popup per achievement, then victory, level and rank in reference order; explicit final Next Level |
| `LossModal` and rewarded/coin continuation branch | `continue` and `loss` modals | Five guesses, one 100-coin extra guess, no ad branch, insufficient-funds shop route |
| `HintModal`, `SkipModal`, `InfoModal` | `hint`, `skip` and notice states | Confirmation, authoritative spend, 50/100/150 costs and shop fallback |
| `CoinShop`, `CoinPurchaseFanfareModal` | `shop` and `reward` modals | Jest catalog price/currency, purchase/grant/complete ordering, balance refresh, purchase and first-purchase achievement fanfares |
| `FullProfileDetailsModal`, `UpdateUsernameModal`, `TreasureChest` | `profile`, `username`, `treasure` modals | Avatar/fallback, username, rank, XP, classic/daily progress, coins and profile navigation |
| `AchievementsModal` | `achievements` modal and `achievements.ts` | All 42 definitions, locked/progress/unlocked states and authoritative object-to-ID mapping |
| `StatsModal` | `statistics` modal | All 14 former statistics |
| `RanksModal`, `RankBadge` | `ranks` modal and `ranks.ts` | All eight ranks, current/next state, badge colour and promotion fanfare |
| `LeaderboardModal` | `leaderboard` modal | XP, wins and streak tabs with authoritative results |
| `SettingsModal` | `settings` modal | Sound, language, help, credits, about/legal and coin shop |
| `CreditsModal`, `AboutLegalModal` | `credits` and `about` modals | Former copy and team credits; unsupported external navigation is not invoked inside Jest |
| `OfflineBlockingModal` | `.offline-backdrop` alert dialog | Online/offline blocking and recovery |
| `GlobalMuteOverlay` | persisted sound toggle plus pause/visibility audio state | Music stops while muted, hidden, interrupted or paused and resumes only after interaction |
| `DeleteAccountConfirmationModal`, `UpgradeAccountModal`, external-auth screens | Jest registration and player continuity | Jest `login()` replaces external auth; account deletion/logout/migration UI is intentionally removed |
| Development modal toggles and debug screens | Removed | Not shipped player functionality |

## Game rule contract

| Rule | Web contract |
|---|---|
| Board | Five rows; variable grapheme answer length; active selectable slot |
| Entry | Custom QWERTY plus physical keyboard; non-sequential editing; locked hint positions |
| Scoring | Shared `@qwordly/core/game` duplicate-letter scoring and key-state priority |
| Attempts | Five initial guesses |
| Continuation | Exactly one additional guess for 100 coins; dismissal records the loss |
| Hint | 50 coins; server chooses and persists an unrevealed position; hinted cell cannot be overwritten |
| Skip | 100 classic / 150 daily; server advances progress |
| Completion | Server validates riddle/mode/attempts and owns rewards, XP, streak, progression and achievements |
| Restoration | Per-player/per-riddle letters, hints, guesses, engine snapshot and key feedback survive reload until terminal completion |
| Daily/classic | Separate authoritative progression and riddle endpoints |

## Visual, motion, audio and asset mapping

| Reference | Web implementation |
|---|---|
| Poppins regular/semibold/bold and Poetsen One | Local `@font-face` assets |
| Purple `#401F40`, gold `#FEC880`, crimson `#F54160`, cream `#FCFAF4` | CSS tokens and exact grid/key feedback colours |
| Native modal frame/reward wheel motion | Responsive cream/gold modal system, rotating/pulsing fanfare visuals and reduced-motion override |
| 19 raw solar PNG files | 15 optimized runtime WebP textures; unused gradient sprites replaced by a generated alpha corona |
| `music.wav` | Visually lossless gameplay substitution: compressed looping Opus `music.webm` |
| `SoundManager` | Browser music unlock, 150 ms fade-out, 700/1000 ms wrong/loss fade-in, mute and interruption recovery |
| Expo haptics | Removed: Jest HTML5 does not expose a haptics capability |
| `chest-open.svg`, `chest-closed.svg` | The displayed open chest is an optimized WebP; the unused closed-state duplicate is retired |
| Ad videos | Removed with the unsupported rewarded-ad branch |

## State, backend and service mapping

| Former module family | Current owner |
|---|---|
| `useGameLogic`, `GameStateManager`, guess utilities | `@qwordly/core/game` plus `gameSession` reducer |
| `RiddleService`, `RiddleDataService`, initialization services | `firebaseServices` and minimal authoritative riddle Functions |
| `FirestoreService`, `UserDataService`, converters | `firebaseServices`, `profileMapper`, typed bridge schemas |
| `AuthService`, `AuthContext`, auth facades | `JestSdkPlatform` signed player identity → `exchangeJestIdentity` → Firebase custom token |
| `IapService`, product pricing, native receipt validators | Jest product catalog and `JestPurchaseCoordinator` → signed idempotent `grantJestPurchase` |
| `SocialSharingService` | Jest referrals, social profile and screenshot provider |
| Native notifications/streak notifications | Jest D1/D3/D7 notification scheduling and replacement |
| `OfflineQueueService` | Local session persistence; authoritative mutations remain online-only and idempotent |
| Analytics | Jest first milestone and privacy-safe funnel events |
| Sentry | Minimal backend error reporting only; no unnecessary client SDK in the artifact |

The retained Firebase Functions are the minimum authority still required by the game: current classic/daily riddle reads, completion, hints, skips/coin spend, username, leaderboard, daily scheduling/content generation, and the three signed Jest trust-boundary endpoints. Native ads, IAP receipt validation, external auth/user management, admin portal and migration Functions are removed.

## Localization inventory

Seventeen locales are retained: English, Spanish, Portuguese, French, German, Japanese, Korean, Simplified Chinese, Hindi, Russian, Turkish, Arabic, Indonesian, Italian, Dutch, Polish and Vietnamese.

Each locale contains exactly the 21 namespaces used by React: `aboutLegal`, `accessibility`, `achievements`, `alerts`, `coinPurchase`, `common`, `credits`, `errors`, `game`, `leaderboard`, `levelUpFanfare`, `loss`, `navigation`, `onboarding`, `profile`, `settings`, `shop`, `stats`, `streakFanfare`, `tooltips` and `victory`. Obsolete ad, external-auth, devtools, logs and test namespaces are deleted. Arabic sets RTL document direction.

## Jest substitution matrix

| Native behavior | Jest HTML5 behavior |
|---|---|
| Firebase/external sign-in | `JestSDK.getPlayerSigned()` verified server-side; `JestSDK.login()` for registration |
| Native IAP | `JestSDK.payments`, signed server grant, durable idempotency, then `completePurchase()` |
| Push notifications | Jest notifications with stable identifiers and replacement |
| Native share sheet | Jest referral share dialog with specific riddle destination |
| Native/social avatar | Jest social profile with null-safe initials fallback |
| Native screenshot capture | Jest screenshot provider with size checks |
| Splash/loading state | Jest manual-loading heartbeat and playable milestone |
| Rewarded/interstitial ads | Removed; coin-only continuation |
| Haptics | Removed because no Jest SDK capability exists |

## Redundant-file retirement

Removed from the working tree after mapping:

- Expo, React Native, EAS, Android and iOS source/build configuration and binaries.
- Admin portal, external-auth, migration, native IAP and ad code.
- Generated coverage, logs, emulator dumps and native test scaffolding.
- Raw 3D PNGs, unused gradient sprites, WAV music, ad videos, giant chest SVGs and unused font weight after optimized replacements were verified.
- Native-only and unreferenced icons, duplicate splash images, unused translation namespaces and old portal/sidebar UI.
- 180 transient/duplicate Android diagnostic captures; 14 curated reference states remain with a generated 25-state React pack.

## Verification evidence

- Portal TypeScript build.
- Portal Jest: reducer, bridge, SDK, purchase, session and mapper coverage.
- Core Jest: 7 suites / 25 tests; portal Jest: 11 suites / 29 tests; Firebase Functions Jest: 18 suites / 343 tests.
- Firebase Functions build plus the full backend test suite.
- Dedicated `build:jest` artifact audit: 372 files / 4.31 MB, relative entry assets, no native modules, ads, external auth, secrets or source maps.
- Browser harness at desktop, 390 × 844 and the 540 × 1170 Android-reference viewport: onboarding, tours, solar scene, exact-fit layout, custom keyboard solve, reload restoration, persistent ordered fanfare, inert/focus-trapped dialogs, iframe hosting and zero console errors.
- `scripts/capture-visual-parity.sh` and `scripts/capture-outcome-parity.sh`: 25 current React states captured, including victory, paid continuation, the extra guess and final loss.
- `docs/visual-parity/README.md`: capture manifest, conditions and explicit Jest-only deviations for the curated Android comparison.
- Canonical progress validation via `pnpm --filter @qwordly/portal check:progress`.
