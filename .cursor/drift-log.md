# Drift Log with MemoryBank

Purpose:

- Store AI mistakes, lessons learned, and tasks persistently.
- Connected to @memorybank for long-term memory.

Format:

- Each entry:
  [date] - [file/feature] - [violation] - [fix applied] - [lesson learned] - [task]

Usage:

- All subagents must append drift entries to memorybank.
- Memorybank automatically updates rules and tasks for the AI.
- AI should reference memorybank before generating code.

---

## Entries

- [2025-03-02] - **Logging** - Excessive console.log in SoundManager/FirestoreService/AuthContext caused JSI crash risk and production noise - Created `src/utils/logger.ts`, migrated 4 critical files - Use centralized logger for all production code - Migrate remaining files (SolarSystemPreloader, LoginScreen, etc.) to logger
- [2025-03-02] - **Logging (continued)** - Completed migration of 30+ production files to logger: RiddleService, UserDataService, RiddleInitializationService, SignUpScreen, ModalProvider, NavigationStack, VictoryModal, fontLoader, AudioFeedbackManager, useGameLogic, useFirstTimeExperience, useRewardedAds, LoginScreen, LandingScreen, ForgotPasswordScreen, IapService, SolarSystemPreloader, audioOptimization, TextureDebugger, ModalTogglePanel, useSettings, useModal, RiddleDataService, AuthService, SocialSharingService, WideButton, GameStateManager, ModalRegistry, useInterstitialAds, CoinShopModal - All production console usage now gated by __DEV__
