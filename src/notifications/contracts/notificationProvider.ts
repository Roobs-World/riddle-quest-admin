/** Provider-neutral delivery state, separate from the player's saved preference. */
export type NotificationDelivery =
  | "unsupported"
  | "not-configured"
  | "permission-required"
  | "blocked"
  | "ready"
  | "inactive"
  | "save-failed";

export type DeviceNotificationSnapshot = Readonly<{
  kind: "device";
  enabled: boolean;
  busy: boolean;
  delivery: NotificationDelivery;
}>;

export type ManagerNotificationSnapshot = Readonly<{
  kind: "manager";
  enabled: boolean;
  busy: boolean;
  available: boolean;
  saveFailed: boolean;
}>;

export type NotificationSnapshot = DeviceNotificationSnapshot | ManagerNotificationSnapshot;

export type NotificationActivity = Readonly<{locale: string}>;

export type NotificationPreferenceStore = {
  getEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  subscribe(listener: () => void): () => void;
};

/** Consent and lifecycle are shared; device response APIs stay on the device branch. */
type NotificationLifecycle<Snapshot extends NotificationSnapshot> = {
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  /** Restores saved state without opening permission UI. */
  restore(): Promise<void>;
  setEnabled(enabled: boolean): Promise<boolean>;
  /** Stops local work without revoking delivery when the game closes. */
  retire(): void;
};

export type DeviceNotificationProvider = NotificationLifecycle<DeviceNotificationSnapshot> & Readonly<{
  kind: "device";
  /** Only a device adapter may request operating-system notification permission. */
  requestPermission(): Promise<boolean>;
  recordActivity(activity: NotificationActivity): Promise<void>;
}>;

export type ManagerNotificationProvider = NotificationLifecycle<ManagerNotificationSnapshot> & Readonly<{
  kind: "manager";
}>;

export type NotificationProvider = DeviceNotificationProvider | ManagerNotificationProvider;

export type NotificationProviderFactory = (context: Readonly<{platform: string}>) => NotificationProvider;

export type NotificationProviderPolicy =
  | Readonly<{kind: "hosted"}>
  | Readonly<{kind: "platform-required"; create: NotificationProviderFactory}>
  | Readonly<{kind: "disabled"}>;

/** Lazy game adapters expose registration and consent, without device delivery methods. */
export type NotificationRegistrationCommands = {
  setEnabled(enabled: boolean): Promise<boolean>;
};
