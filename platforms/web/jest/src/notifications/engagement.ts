/** Defines the legacy reminder ids value. */
export const LEGACY_REMINDER_IDS = ["riddle-quest-d1-v2", "riddle-quest-d3-v2", "riddle-quest-d7-v2"] as const;
/** Defines the engagement reminder ids value. */
export const ENGAGEMENT_REMINDER_IDS = Array.from({length: 7}, (_, index) => `riddle-quest-d${index + 1}-v3`);
/** Stable identifier for the current Race-to-10 results reminder. */
export const RACE_RESULTS_REMINDER_ID = "race_to_10_results_v1";
/** Legacy Race-to-10 reminder identifier retained for migration cleanup. */
export const LEGACY_RACE_REMINDER_ID = "race_to_10_return_v1";
/** Race reminder identifiers retained for cleanup across identifier migrations. */
export const RACE_REMINDER_IDS = [LEGACY_RACE_REMINDER_ID, RACE_RESULTS_REMINDER_ID] as const;
/** Every app-owned notification identifier that account deletion must unschedule. */
export const PLAYER_NOTIFICATION_IDS = [
  ...LEGACY_REMINDER_IDS,
  ...ENGAGEMENT_REMINDER_IDS,
  ...RACE_REMINDER_IDS,
] as const;
