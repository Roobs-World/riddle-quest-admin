/** Detects visible text damaged by a failed translation/encoding replacement. */
export const hasQuestionMarkReplacementText = (value) =>
  typeof value === "string" && (
    /\?{3,}/u.test(value) ||
    (/\?{2}/u.test(value) && /^[\p{P}\p{S}\s]+$/u.test(value)) ||
    /\p{L}\?+\p{L}/u.test(value)
  );

/** Locale keys from removed features that Jest's launch requirements do not permit. */
export const unsupportedJestLocaleKeys = Object.freeze([
  "Accessibility.SHARE_TO_X",
  "Profile.ALERT_INVALID_CURRENT_PASSWORD",
  "Profile.ALERT_PASSWORD_CHANGE_ERROR",
  "Profile.ALERT_PASSWORD_FIELDS_EMPTY",
  "Profile.ALERT_PASSWORD_TOO_SHORT",
  "Profile.ALERT_PASSWORD_UPDATE_SUCCESS",
  "Profile.ALERT_PASSWORDS_DO_NOT_MATCH",
  "Profile.ALERT_USER_NOT_LOGGED_IN",
  "Profile.CHANGE_PASSWORD_BUTTON",
  "Profile.CHANGE_PASSWORD_TITLE",
  "Profile.CONFIRM_NEW_PASSWORD_PLACEHOLDER",
  "Profile.CURRENT_PASSWORD_PLACEHOLDER",
  "Profile.GUEST_MODE_DESCRIPTION",
  "Profile.LINK_ACCOUNTS_BUTTON",
  "Profile.NEW_PASSWORD_PLACEHOLDER",
  "Profile.UPGRADE_ACCOUNT_DESCRIPTION",
  "Profile.UPGRADE_ACCOUNT_ERROR",
  "Profile.UPGRADE_ACCOUNT_EXISTING_ACCOUNT_DESCRIPTION",
  "Profile.UPGRADE_ACCOUNT_EXISTING_ACCOUNT_TITLE",
  "Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE",
  "Profile.UPGRADE_ACCOUNT_SUCCESS",
  "Profile.UPGRADE_ACCOUNT_TITLE",
  "Settings.HAPTICS_TOGGLE",
  "Settings.PRIVACY_POLICY_BUTTON",
  "Settings.TEST_CRASH_ALERT_CANCEL",
  "Settings.TEST_CRASH_ALERT_CRASH",
  "Settings.TEST_CRASH_ALERT_MESSAGE",
  "Settings.TEST_CRASH_ALERT_TITLE",
  "Settings.TEST_CRASH_BUTTON",
]);

const unsupportedJestLocaleKeySet = new Set(unsupportedJestLocaleKeys);

/** Returns whether a locale path belongs to a removed, platform-incompatible feature. */
export const isUnsupportedJestLocaleKey = (key) => unsupportedJestLocaleKeySet.has(key);
