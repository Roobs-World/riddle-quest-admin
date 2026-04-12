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
      PASSWORD_CANNOT_BE_EMPTY: "Password cannot be empty",
      USER_NOT_FOUND_ERROR: "User not found. Please check your email.",
      WRONG_PASSWORD_ERROR: "Incorrect password. Please try again.",
      USER_DISABLED_ERROR: "This account has been disabled.",
      ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
        "Account exists with different credential. Please use a different login method.",
      OPERATION_NOT_SUPPORTED_ERROR:
        "Operation not supported in this environment.",
      LOGIN_FAILED_GENERIC: "Login failed. Please check your credentials.",
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
      USERNAME_CANNOT_BE_EMPTY: "Username cannot be empty",
      EMAIL_ALREADY_IN_USE_ERROR: "This email address is already in use.",
      INVALID_EMAIL_ERROR: "The email address is invalid.",
      OPERATION_NOT_ALLOWED_ERROR: "Email and password sign-up is not enabled.",
      WEAK_PASSWORD_ERROR: "The password is too weak.",
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
  },
  Achievements: {
    UNLOCKED_ALERT_TITLE: "Achievement(s) Unlocked!",
    UNLOCKED_ALERT_MESSAGE: "Check your profile to see your new achievements.",
    UNLOCKED_ALERT_OK: "OK",
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
