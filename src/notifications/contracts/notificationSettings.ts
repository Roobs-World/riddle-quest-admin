/** Target-owned delivery changes for the shared notification preference. */
export type NotificationSettingsCapability = {
  /** Applies the preference to provider reminders and push delivery. */
  setEnabled(enabled: boolean): Promise<boolean>;
};
