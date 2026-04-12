import {
  esOverrides,
  ptOverrides,
  frOverrides,
  deOverrides,
  jaOverrides,
  koOverrides,
  zhOverrides,
  ruOverrides,
  trOverrides,
} from "../i18n/languageOverrides";

const EN_APP_STRINGS = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Join millions of people to play QWORDLY.",
      TAGLINE_2: "Ready to have fun while training your mind?",
      SIGN_IN_BUTTON: "Sign in",
      OR_SIGN_IN_WITH: "or Sign in with",
      NO_ACCOUNT_PROMPT: "Don't have an account? ",
      PLAY_AS_GUEST: "Play as Guest",
      CREDITS_BUTTON: "Credits",
      SIGN_UP_BUTTON: "Sign up",
    },
    Login: {
      TITLE: "Log in",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Enter your email",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "Enter your password",
      FORGOT_PASSWORD: "Forgot password?",
      LOGIN_BUTTON: "Log In",
      NO_ACCOUNT_PROMPT: "Don't have an account? ",
      REGISTER_NOW: "Register Now",
      INVALID_EMAIL_FORMAT_ERROR: "Invalid email format ✗",
      OR_LOGIN_WITH: "Or login with",
      CONTINUE_WITH_GOOGLE: "Continue with Google",
      CONTINUE_WITH_FACEBOOK: "Continue with Facebook",
      CONTINUE_WITH_TWITTER: "Continue with X",
      PASSWORD_CANNOT_BE_EMPTY: "Password cannot be empty",
      USER_NOT_FOUND_ERROR: "User not found. Please check your email.",
      WRONG_PASSWORD_ERROR: "Incorrect password. Please try again.",
      USER_DISABLED_ERROR: "This account has been disabled.",
      ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
        "Account exists with different credential. Please use a different login method.",
      OPERATION_NOT_SUPPORTED_ERROR:
        "Operation not supported in this environment.",
      LOGIN_FAILED_GENERIC: "Login failed. Please check your credentials.",
      GOOGLE_UNEXPECTED_ERROR: "An unexpected error occurred during Google login.",
      TWITTER_UNEXPECTED_ERROR: "An unexpected error occurred during X login.",
      FACEBOOK_CONFIG_ERROR:
        "Facebook login configuration issue. Please try again or contact support.",
      FACEBOOK_TIMEOUT_ERROR:
        "Facebook login timed out. This may indicate a configuration issue. Please try again.",
      FACEBOOK_SDK_ERROR:
        "Facebook login is not properly configured. Please restart the app and try again.",
      FACEBOOK_NETWORK_ERROR:
        "Network error during Facebook login. Please check your connection and try again.",
      FACEBOOK_INVALID_CREDENTIAL_ERROR: "Invalid Facebook credentials. Please try again.",
      FACEBOOK_UNEXPECTED_ERROR: "An unexpected error occurred during Facebook login.",
    },
    SignUp: {
      TITLE: "Create your account",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "Enter your username",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Enter your email",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "Enter your password",
      CONFIRM_PASSWORD_LABEL: "Confirm Password",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirm your password",
      PASSWORD_DOES_NOT_MATCH: "Passwords do not match ✗",
      PASSWORD_DOES_NOT_LONG_ENOUGH: "Password is too short ✗",
      PASSWORD_VALIDATION_GOOD: "Passwords match ✓",
      TERMS_AGREEMENT_PART1: "I agree to the ",
      TERMS_USER_AGREEMENT: "user agreement",
      TERMS_AGREEMENT_PART2: " and ",
      TERMS_PRIVACY_POLICY: "privacy policy",
      NEXT_BUTTON: "Next",
      HAS_ACCOUNT_PROMPT: "Do you have an account? ",
      LOGIN_NOW: "Log in now",
      MUST_AGREE_TO_TERMS: "Please agree to the terms and privacy policy.",
      USERNAME_CANNOT_BE_EMPTY: "Username cannot be empty",
      EMAIL_ALREADY_IN_USE_ERROR: "This email address is already in use.",
      INVALID_EMAIL_ERROR: "The email address is invalid.",
      OPERATION_NOT_ALLOWED_ERROR: "Email and password sign-up is not enabled.",
      WEAK_PASSWORD_ERROR: "The password is too weak.",
      SIGNUP_UNEXPECTED_ERROR: "An unexpected error occurred during sign up.",
      TERMS_PAGE_NAME: "Terms of Service",
      PRIVACY_POLICY_PAGE_NAME: "Privacy Policy",
    },
    NewPassword: {
      TITLE: "Set New Password",
      NEW_PASSWORD_DESCRIPTION:
        "Reset your password to recovery & login to your account.",
      NEW_PASSWORD_LABEL: "New Password",
      NEW_PASSWORD_PLACEHOLDER: "Enter your new password",
      CONFIRM_PASSWORD_LABEL: "Confirm New Password",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirm your new password",
      SET_PASSWORD_BUTTON: "Confirm",
    },
    ForgotPassword: {
      TITLE: "Reset Password",
      BUTTON_TEXT: "Reset Password",
      SUCCESS_MESSAGE: "Password reset email sent! Check your inbox.",
      USER_NOT_FOUND_ERROR:
        "No account found with this email address. Please check your email or sign up for a new account.",
      GENERIC_ERROR:
        "An error occurred while sending the reset email. Please try again.",
      BACK_TO_LOGIN: "Back to Login",
    },
  },
  Navigation: {
    LOGIN: "Login",
    SIGN_UP: "SignUp",
    LANDING: "Landing",
    FORGOT_PASSWORD: "ForgotPassword",
    NEW_PASSWORD: "NewPassword",
    GAME: "Game",
    CREDITS: "Credits",
    PLAY_BUTTON: "Play",
    PROFILE_BUTTON: "Profile",
    SETTINGS_BUTTON: "Settings",
    HINT_BUTTON: "Hint",
  },
  NavigationMessages: {
    NO_CLASSIC_RIDDLE_FOUND: "⚠️ No classic riddle found at index ",
    SERVER_GENERATES_RIDDLES:
      ". Server will generate new riddles automatically when you submit guesses.",
    ERROR_LOADING_NEXT_RIDDLE: "Error loading next classic riddle:",
  },
  Settings: {
    TITLE: "Settings",
    SOUND_TOGGLE: "Sound",
    HAPTICS_TOGGLE: "Haptics",
    LANGUAGE_LABEL: "Language",
    HELP_BUTTON: "Help",
    LOGOUT_BUTTON: "Logout",
    CREDITS_BUTTON: "Credits",
    TEST_CRASH_BUTTON: "Test Crash",
    TEST_CRASH_ALERT_TITLE: "Test Crash",
    TEST_CRASH_ALERT_MESSAGE:
      "This will crash the app to test Firebase Crashlytics. Continue?",
    TEST_CRASH_ALERT_CANCEL: "Cancel",
    TEST_CRASH_ALERT_CRASH: "Crash",
    CLOSE_BUTTON: "Close",
    LOGOUT_ERROR_TITLE: "Error",
    LOGOUT_ERROR_MESSAGE: "Could not log out. Please try again.",
    TOGGLE_ON: "On",
    TOGGLE_OFF: "Off",
    LANGUAGE_SELECTED: "Selected",
  },
  Credits: {
    TITLE: "Credits",
    SUBTITLE: "Meet the amazing team behind Qwordly",
    THANK_YOU_TITLE: "Thank You!",
    THANK_YOU_TEXT:
      "Special thanks to all our contributors who made Qwordly possible. Your creativity, dedication, and passion brought this project to life.",
  },
  WelcomeModal: {
    LETS_PLAY: "Let's Play",
    WELCOME_TITLE: "Welcome to\nQwordly!",
    SOLVE_RIDDLES_TEXT:
      "Solve engaging riddles by guessing the answer letter by letter. Use the colour clues to narrow down each guess.",
    EARN_COINS_TEXT:
      "Earn coins, beat daily challenges, and climb the leaderboard.",
  },
  Instructions: {
    TITLE: "How to Play",
    GOAL_TITLE: "The Goal",
    GOAL_DESCRIPTION:
      "Guess the hidden riddle in 3 tries using the color clues to guide you.",
    COLOR_CLUES_TITLE: "Color Clues",
    COLOR_CORRECT: "Letter is correct and in the right position",
    COLOR_MISPLACED: "Letter is in the word but wrong position",
    COLOR_WRONG: "Letter is not in the word at all",
    TIPS_TITLE: "Tips for Success",
    TIPS_DESCRIPTION:
      "Start with common letters and use the color feedback to narrow down your guesses. Remember, you only have 3 attempts!",
    GOT_IT_BUTTON: "Got It!",
  },
  Profile: {
    LOADING_MESSAGE: "Loading profile data...",
    TITLE: "Profile",
    USERNAME_LABEL: "Username:",
    SAVE_BUTTON: "Save",
    EDIT_BUTTON: "Edit",
    ACCOUNT_SETTINGS_TITLE: "Account Settings",
    CHANGE_PASSWORD_BUTTON: "Change Password",
    LINK_ACCOUNTS_BUTTON: "Link Accounts",
    STATS_TITLE: "Stats",
    DAILY_PUZZLES_STAT: "Daily Puzzles",
    BEST_STREAK_STAT: "Best Streak",
    WORDS_GUESSED_STAT: "Words Guessed",
    WIN_RATE_STAT: "Win Rate",
    AVG_GUESSES_STAT: "Avg. Guesses",
    TOTAL_SCORE_STAT: "Total Score",
    HIGHEST_CLASSIC_LEVEL_STAT: "Highest Classic Level",
    GAMES_PLAYED_STAT: "Games Played",
    TOTAL_WINS_STAT: "Total Wins",
    ALERT_ERROR_TITLE: "Error",
    ALERT_USERNAME_EMPTY: "Username cannot be empty.",
    ALERT_SUCCESS_TITLE: "Success",
    ALERT_USERNAME_UPDATE_SUCCESS: "Username updated successfully!",
    ALERT_USERNAME_UPDATE_FAIL: "Failed to update username. Please try again.",
    CHANGE_AVATAR_TITLE: "Change Avatar",
    SELECT_PRELOADED_AVATAR_SUBTITLE: "Select a Preloaded Avatar:",
    UPLOAD_CUSTOM_AVATAR_SUBTITLE: "Or Upload Your Own:",
    CHOOSE_FROM_GALLERY_BUTTON: "Choose from Gallery",
    CANCEL_BUTTON: "Cancel",
    ALERT_AVATAR_SELECT_FAIL: "Could not select avatar. Please try again.",
    ALERT_AVATAR_UPDATE_SUCCESS: "Avatar updated successfully!",
    ALERT_PRELOADED_AVATAR_SELECT_FAIL:
      "Failed to select preloaded avatar. Please try again.",
    ALERT_AVATAR_UPDATE_FACEBOOK_SUCCESS: "Avatar updated to Facebook photo!",
    ALERT_USERNAME_TOO_SHORT: "Username must be at least 3 characters long.",
    ALERT_PASSWORD_FIELDS_EMPTY: "Please fill in all password fields.",
    ALERT_PASSWORDS_DO_NOT_MATCH: "New passwords do not match.",
    ALERT_PASSWORD_TOO_SHORT: "New password must be at least 6 characters long.",
    ALERT_USER_NOT_LOGGED_IN: "User not logged in or email not available.",
    ALERT_PASSWORD_UPDATE_SUCCESS: "Password updated successfully!",
    ALERT_AVATAR_UPDATE_ERROR: "Could not update avatar. Please try again.",
    ALERT_AN_ERROR_OCCURRED: "An error occurred.",
    ALERT_USERNAME_ALREADY_TAKEN: "Username already taken.",
    UPDATE_USERNAME_TITLE: "Update Username",
    ENTER_NEW_USERNAME_PLACEHOLDER: "Enter new username",
    ALERT_USERNAME_UPDATE_FAILED: "Username update failed.",
    CHANGE_PASSWORD_TITLE: "Change Password",
    CURRENT_PASSWORD_PLACEHOLDER: "Current Password",
    NEW_PASSWORD_PLACEHOLDER: "New Password",
    CONFIRM_NEW_PASSWORD_PLACEHOLDER: "Confirm New Password",
    ALERT_PASSWORD_CHANGE_ERROR: "An error occurred while changing password.",
    ALERT_INVALID_CURRENT_PASSWORD: "Invalid current password.",
    SELECT_AVATAR_TITLE: "Select Avatar",
    UPDATE_AVATAR_TITLE: "Update Avatar",
    UPLOAD_FROM_LIBRARY_BUTTON: "Upload from Photo Library",
    CHOOSE_OUR_AVATARS_BUTTON: "Choose from Our Avatars",
    USE_FACEBOOK_PHOTO_BUTTON: "Use Facebook Photo",
    ALERT_FACEBOOK_AVATAR_SET_FAIL: "Could not set Facebook avatar. Please try again.",
    ALERT_NO_FACEBOOK_PHOTO:
      "No Facebook photo available. Please link your Facebook account first.",
    PROFILE_HEADER: "PROFILE",
    DAILY_PUZZLES_COMPLETED_HEADER: "Daily puzzles completed",
    REGULAR_DAYS_LABEL: "Regular Days\nCompleted",
    BEST_STRIKE_HEADER: "Best Strike",
    AVG_GUESS_LABEL: "Average guess",
    XP_LEVEL_PREFIX: "Lv.",
    TREASURE_CHEST_TITLE: "Your Treasure Chest",
    TOTAL_COINS_LABEL: "Total Coins:",
    GUEST_USERNAME: "Guest",
    GUEST_MODE_TITLE: "Playing as a guest",
    GUEST_MODE_DESCRIPTION:
      "Upgrade to an account with a provider to keep your progress and access all features.",
    UPGRADE_ACCOUNT_BUTTON: "Upgrade Account",
    UPGRADE_ACCOUNT_TITLE: "Upgrade your account",
    UPGRADE_ACCOUNT_DESCRIPTION:
      "Choose a provider to link to this guest session. Your progress stays on this device and will be saved to your account.",
    UPGRADE_ACCOUNT_SUCCESS: "Account upgraded successfully!",
    UPGRADE_ACCOUNT_ERROR: "Could not upgrade your account. Please try again.",
    UPGRADE_ACCOUNT_PROVIDER_IN_USE:
      "That provider account is already in use. Please choose a different provider.",
  },
  TestStrings: {
    MOCK_SVG_TEXT: "Mock SVG Text",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "You're out of guesses! Watch an ad to earn some coins?",
    WATCH_AD_BUTTON: "Watch Ad",
    NO_THANKS_BUTTON: "No Thanks",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Unable to load any riddles. Please check your connection and try again.",
    FAILED_TO_INITIALIZE_RIDDLE_DATABASE:
      "Failed to initialize the riddle database. This might be your first time using the app.",
    CHECK_INTERNET_AND_TRY_AGAIN: "Please check your internet connection and try again.",
    FAILED_TO_LOAD_PRODUCTS: "Failed to load products",
    FAILED_TO_LOAD_SHOP_PRODUCTS: "Failed to load shop products",
  },
  CommonButtons: {
    RETRY: "Retry",
  },
  DevTools: {
    MODAL_TESTING_HEADER: "Modal Testing",
    COMPLETE_RIDDLE_BUTTON: "Complete Riddle",
    GENERATE_DAILY_CHALLENGE_BUTTON: "Generate Daily Challenge",
    CLEAR_ALL_BUTTON: "Clear All",
  },
  GameMessages: {
    GAME_WON: "Game Won: Attempts - ",
    IN_MODE: " in ",
    MODE_SUFFIX: " mode.",
    COINS_EARNED: "Coins Earned: ",
    GAME_LOST: "Game Lost: Correct Answer - ",
    HINT_USED: "Hint Used: Cost - ",
    RETRY_BUTTON_PRESSED: "Retry button pressed",
  },
  LogMessages: {
    SHOWING_LOADING_SPINNER_USER_DATA:
      "⏳ Showing loading spinner - Loading user data...",
    TIMESTAMP: "timestamp:",
    SHOWING_LOADING_SPINNER_AUTH:
      "⏳ Showing loading spinner - authentication state being determined",
    NAVIGATION_RENDERING: "🧭 Navigation rendering - isAuthenticated:",
    IS_LOADING: "isLoading:",
    SHOWING_NAVIGATION_STACK: "🎯 Showing navigation stack - initialRoute:",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Error",
    SUBMIT_GUESS_ERROR_MESSAGE: "Could not submit guess. Please try again.",
    NOT_ENOUGH_COINS_TITLE: "Not enough coins",
    NOT_ENOUGH_COINS_MESSAGE: "You need more coins to use a hint.",
    HINT_ERROR_TITLE: "Error",
    GUEST_MODE_NOTICE_TITLE: "Guest Mode Notice",
    AD_NOT_READY_TITLE: "Ad Not Ready",
    AD_NOT_READY_MESSAGE:
      "The rewarded ad couldn't be shown at this time. Please try again shortly.",
    SPEND_COINS_ERROR_MESSAGE: "Could not spend coins. Please try again.",
    HINT_NOT_AVAILABLE_TITLE: "Hint Not Available",
    HINT_NOT_AVAILABLE_MESSAGE: "No more letters can be revealed.",
    PURCHASE_FAILED_TITLE: "Purchase Failed",
    PURCHASE_FAILED_MESSAGE: "Purchase failed. Please try again.",
    GUEST_MODE_NOTICE_MESSAGE:
      "Your progress could be lost in guest mode, and some features like the leaderboard are unavailable.",
    SUBMIT_BUTTON: "SUBMIT",
    NEXT_BUTTON: "Next",
    DAILY_CHALLENGE_LABEL: "Daily Challenge",
    CLASSIC_LABEL: "Classic",
    HINT_MODAL_TITLE: "Use a Hint?",
    HINT_NOT_ENOUGH_COINS_MESSAGE: "You do not have enough coins for a hint.",
    HINT_SHOW_BUTTON: "SHOW HINT",
    SKIP_MODAL_TITLE: "Skip the level?",
    SKIP_NOT_ENOUGH_COINS_MESSAGE: "You do not have enough coins to skip a level.",
    SKIP_LEVEL_BUTTON: "SKIP LEVEL",
    COST_COINS_PREFIX: "Cost: ",
    COST_COINS_MIDDLE: " Coins. You have: ",
    COST_COINS_SUFFIX: " Coins.",
  },
  VictoryModal: {
    TITLE: "Victory!",
    YOU_WON_TITLE: "YOU WON!",
    ACHIEVEMENT_UNLOCKED: "Achievement Unlocked!",
    COINS_SUFFIX: " Coins",
    SHARE_TEXT: "Share your victory!",
    NEXT_LEVEL_BUTTON: "Next Level",
  },
  LossModal: {
    TITLE: "So close!",
    OUT_OF_ATTEMPTS: "Out of attempts.",
    WATCH_AD_BUTTON: "Watch Ad to Continue",
    OPEN_SHOP_BUTTON: "Open Shop",
    NEXT_LEVEL_BUTTON: "Next Level",
    USE_COINS_PREFIX: "Use ",
    USE_COINS_SUFFIX: " Coins to Continue",
    SKIP_LEVEL_PREFIX: "Skip Level (",
    SKIP_LEVEL_SUFFIX: " Coins)",
  },
  Achievements: {
    UNLOCKED_ALERT_TITLE: "Achievement(s) Unlocked!",
    UNLOCKED_ALERT_MESSAGE: "Check your profile to see your new achievements.",
    UNLOCKED_ALERT_OK: "OK",
    MODAL_TITLE: "Achievements",
    FANFARE_TITLE: "Achievement Unlocked!",
    MORE_UNLOCKED_SUFFIX: " more unlocked",
    NICE_BUTTON: "Nice",
    NEW_ACHIEVEMENT: "New Achievement",
  },
  CoinPurchase: {
    TITLE: "Coins Added!",
    COINS_SUFFIX: " Coins",
    AWESOME_BUTTON: "Awesome",
  },
  StreakFanfare: {
    TITLE: "Streak Increased!",
    STREAK_SUFFIX: "-Day Streak",
    CONTINUE_BUTTON: "Keep Going",
  },
  Leaderboard: {
    TITLE: "Leaderboard",
    TAB_XP: "XP",
    TAB_WINS: "Wins",
    TAB_STREAK: "Streak",
    LOAD_ERROR: "Could not load leaderboard. Please try again.",
    RETRY_BUTTON: "Retry",
    NO_SCORES_YET: "No scores yet — be the first to make the board!",
  },
  StatsModal: {
    TITLE: "Statistics",
    GAMEPLAY_SECTION: "Gameplay",
    WINS_STREAKS_SECTION: "Wins & Streaks",
    PERFORMANCE_SECTION: "Performance",
    GAMES_PLAYED: "Games Played",
    DAILY_PUZZLES: "Daily Puzzles",
    HIGHEST_CLASSIC_LEVEL: "Highest Classic Level",
    XP: "XP",
    TOTAL_WINS: "Total Wins",
    WIN_RATE: "Win Rate",
    BEST_STREAK: "Best Streak",
    CURRENT_STREAK: "Current Streak",
    CHALLENGE_WINS: "Challenge Wins",
    AVG_GUESSES: "Avg Guesses (wins)",
    TOTAL_WORDS_GUESSED: "Total Words Guessed",
    TOTAL_SCORE: "Total Score",
    HINTS_USED: "Hints Used",
  },
  CoinShop: {
    TITLE: "COIN SHOP",
    YOUR_BALANCE: "Your balance",
    COINS_SUFFIX: " coins",
    LOADING_TEXT: "Loading shop...",
    NO_PACKS_AVAILABLE: "No coin packs are available right now.",
    PURCHASE_BUTTON: "PURCHASE",
  },
  CommonAlerts: {
    ERROR_TITLE: "Error",
    SUCCESS_TITLE: "Success",
    INFO_TITLE: "Info",
    OK_BUTTON: "OK",
    CANCEL_BUTTON: "Cancel",
    CLOSE_BUTTON: "Close",
    UNABLE_TO_OPEN_TITLE: "Unable to Open",
    CANNOT_OPEN_PREFIX: "Cannot open ",
    CANNOT_OPEN_VISIT_SUFFIX: ". Please visit ",
    CANNOT_OPEN_BROWSER_SUFFIX: " in your browser.",
    COULD_NOT_OPEN_PREFIX: "Could not open ",
    COULD_NOT_OPEN_TRY_AGAIN: ". Please try again later.",
  },
  Accessibility: {
    MUTE_SOUND: "Mute sound",
    UNMUTE_SOUND: "Unmute sound",
    OPEN_SETTINGS: "Open settings",
    OPEN_SETTINGS_HINT:
      "Access game settings, sound options, and account management",
    CHANGE_GAME_MODE: "Change game mode",
    CHANGE_GAME_MODE_HINT: "Select Classic or Daily Challenge mode",
    OPEN_PROFILE: "Open profile",
    OPEN_PROFILE_HINT: "View your profile, statistics, and game progress",
    CLOSE_COIN_SHOP: "Close coin shop",
    SUBMIT_GUESS: "Submit current guess",
    NEXT_LEVEL_HINT: "Advance to the next level after completing this one",
    BACKSPACE: "Backspace",
    DELETE_LAST_LETTER: "Delete the last entered letter",
    LETTER_PREFIX: "Letter ",
    GAME_HEADER: "Game header with logo and coin balance",
    LOADING: "Loading",
    GO_BACK: "Go back",
    BACK_BUTTON_HINT: "Double tap to navigate back or to the previous screen",
    NAVIGATE_TO_PREFIX: "Navigate to ",
    GAME_LOSS_NOTIFICATION: "Game loss notification",
    CLOSE_ACHIEVEMENTS: "Close achievements",
    CLOSE_STATISTICS: "Close statistics",
    CLOSE_LEADERBOARD: "Close leaderboard",
    LOADING_LEADERBOARD: "Loading leaderboard",
    SHARE_TO_FACEBOOK: "Share to Facebook",
    SHARE_TO_X: "Share to X",
    SHARE_SYSTEM: "Share",
  },
} as const;
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends object
        ? { [K in keyof T]: WidenLiteral<T[K]> }
        : T;

export type AppStringsSchema = WidenLiteral<typeof EN_APP_STRINGS>;
export type SupportedLanguage =
  | "en"
  | "es"
  | "pt"
  | "fr"
  | "de"
  | "ja"
  | "ko"
  | "zh"
  | "ru"
  | "tr";

export const SUPPORTED_LANGUAGES: ReadonlyArray<SupportedLanguage> = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "zh",
  "ru",
  "tr",
] as const;

export const APP_LANGUAGE_STORAGE_KEY = "appLanguage";

export const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: SupportedLanguage;
  label: string;
}> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "简体中文" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const deepMerge = <T extends Record<string, unknown>>(
  base: T,
  overrides?: DeepPartial<T>
): T => {
  if (!overrides) {
    return base;
  }

  const output: Record<string, unknown> = { ...base };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const baseValue = output[key];

    if (isPlainObject(baseValue) && isPlainObject(value)) {
      output[key] = deepMerge(
        baseValue as Record<string, unknown>,
        value as DeepPartial<Record<string, unknown>>
      );
      return;
    }

    output[key] = value;
  });

  return output as T;
};

const baseStrings: AppStringsSchema = EN_APP_STRINGS;
const localizedStrings: Record<SupportedLanguage, AppStringsSchema> = {
  en: baseStrings,
  es: deepMerge(baseStrings, esOverrides),
  pt: deepMerge(baseStrings, ptOverrides),
  fr: deepMerge(baseStrings, frOverrides),
  de: deepMerge(baseStrings, deOverrides),
  ja: deepMerge(baseStrings, jaOverrides),
  ko: deepMerge(baseStrings, koOverrides),
  zh: deepMerge(baseStrings, zhOverrides),
  ru: deepMerge(baseStrings, ruOverrides),
  tr: deepMerge(baseStrings, trOverrides),
};

const lazyLanguagePromises = new Map<
  SupportedLanguage,
  Promise<AppStringsSchema>
>();

/* istanbul ignore next */
const getLanguageOverride = (
  language: SupportedLanguage,
  overrides: {
    esOverrides: DeepPartial<AppStringsSchema>;
    ptOverrides: DeepPartial<AppStringsSchema>;
    frOverrides: DeepPartial<AppStringsSchema>;
    deOverrides: DeepPartial<AppStringsSchema>;
    jaOverrides: DeepPartial<AppStringsSchema>;
    koOverrides: DeepPartial<AppStringsSchema>;
    zhOverrides: DeepPartial<AppStringsSchema>;
    ruOverrides: DeepPartial<AppStringsSchema>;
    trOverrides: DeepPartial<AppStringsSchema>;
  }
): DeepPartial<AppStringsSchema> | undefined => {
  switch (language) {
    case "es":
      return overrides.esOverrides;
    case "pt":
      return overrides.ptOverrides;
    case "fr":
      return overrides.frOverrides;
    case "de":
      return overrides.deOverrides;
    case "ja":
      return overrides.jaOverrides;
    case "ko":
      return overrides.koOverrides;
    case "zh":
      return overrides.zhOverrides;
    case "ru":
      return overrides.ruOverrides;
    case "tr":
      return overrides.trOverrides;
    default:
      return undefined;
  }
};

let currentLanguage: SupportedLanguage = "en";

const normalizeLanguage = (language: string): SupportedLanguage => {
  const lower = language.toLowerCase();

  if (lower.startsWith("es")) {
    return "es";
  }
  if (lower.startsWith("pt")) {
    return "pt";
  }
  if (lower.startsWith("fr")) {
    return "fr";
  }
  if (lower.startsWith("de")) {
    return "de";
  }
  if (lower.startsWith("ja")) {
    return "ja";
  }
  if (lower.startsWith("ko")) {
    return "ko";
  }
  if (lower.startsWith("zh")) {
    return "zh";
  }
  if (lower.startsWith("ru")) {
    return "ru";
  }
  if (lower.startsWith("tr")) {
    return "tr";
  }

  return "en";
};

export const isSupportedLanguage = (
  language: string
): language is SupportedLanguage => {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
};

export const getLanguageLabel = (language: SupportedLanguage): string => {
  const option = LANGUAGE_OPTIONS.find((entry) => entry.code === language);
  return option?.label ?? "English";
};

export const getAppLanguage = (): SupportedLanguage => currentLanguage;

export const setAppLanguage = (language: SupportedLanguage): void => {
  currentLanguage = language;
};

export const loadAppStringsForLanguage = async (
  language: SupportedLanguage
): Promise<AppStringsSchema> => {
  if (localizedStrings[language]) {
    return localizedStrings[language];
  }

  /* istanbul ignore next */
  const inFlight = lazyLanguagePromises.get(language);
  if (inFlight) {
    return inFlight;
  }

  /* istanbul ignore next */
  const loader = import("../i18n/languageOverrides").then((module) => {
    const override = getLanguageOverride(language, module);
    const merged = override
      ? deepMerge(EN_APP_STRINGS, override)
      : EN_APP_STRINGS;
    localizedStrings[language] = merged;
    return merged;
  });

  lazyLanguagePromises.set(language, loader);
  return loader;
};

export const setAppLanguageAsync = async (
  language: SupportedLanguage
): Promise<void> => {
  await loadAppStringsForLanguage(language);
  setAppLanguage(language);
};

export const detectDeviceLanguage = (locale?: string): SupportedLanguage => {
  const resolvedLocale =
    locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  const language = normalizeLanguage(resolvedLocale);
  currentLanguage = language;
  return currentLanguage;
};

// Backward-compatible alias. Prefer detectDeviceLanguage in non-hook contexts.
export const useDeviceLanguage = detectDeviceLanguage;

export const getAppStrings = (): AppStringsSchema =>
  localizedStrings[currentLanguage];

const getTypedAppStrings = (): typeof EN_APP_STRINGS =>
  getAppStrings() as typeof EN_APP_STRINGS;

export const AppStrings: typeof EN_APP_STRINGS = new Proxy(
  {} as typeof EN_APP_STRINGS,
  {
  get(_target, prop) {
    return Reflect.get(getTypedAppStrings(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getTypedAppStrings());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getTypedAppStrings(), prop);
  },
}
);
