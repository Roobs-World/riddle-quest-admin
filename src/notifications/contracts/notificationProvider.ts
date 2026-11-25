/** Provider-neutral delivery state, separate from the player's saved preference. */
export type NotificationDelivery =
  | "unsupported"
  | "not-configured"
  | "permission-required"
  | "blocked"
  | "ready"
  | "inactive"
  | "setup-failed"
  | "save-failed";

/** An account-bound, short-lived browser handoff shown only to the player. */
export type NotificationSetupLink = Readonly<{url: string; expiresAtMs: number}>;

export type NotificationSnapshot = Readonly<{
  enabled: boolean;
  busy: boolean;
  delivery: NotificationDelivery;
  setupLink?: NotificationSetupLink;
}>;

export type NotificationActivity = Readonly<{locale: string}>;

export type NotificationPreferenceStore = {
  getEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  subscribe(listener: () => void): () => void;
};

/** Every hosted, platform-required or custom implementation owns this lifecycle and its state. */
export interface NotificationProvider {
  getSnapshot(): NotificationSnapshot;
  subscribe(listener: () => void): () => void;
  /** Restores saved state without opening permission UI. */
  restore(): Promise<void>;
  setEnabled(enabled: boolean): Promise<boolean>;
  /** Called directly from a Settings interaction when delivery needs permission. */
  requestPermission(): Promise<boolean>;
  recordActivity(activity: NotificationActivity): Promise<void>;
  /** Stops local work without revoking delivery when the game closes. */
  retire(): void;
}

export type NotificationProviderFactory = (context: Readonly<{platform: string}>) => NotificationProvider;

export type NotificationProviderPolicy =
  | Readonly<{kind: "hosted"}>
  | Readonly<{kind: "platform-required"; create: NotificationProviderFactory}>
  | Readonly<{kind: "disabled"}>;

/** A narrow command port used when platform delivery is loaded after the game. */
export type NotificationPreferenceCommand = Pick<NotificationProvider, "setEnabled" | "requestPermission"> & {
  restoreDelivery(): Promise<NotificationDelivery>;
  getSetupLink?(): NotificationSetupLink | null;
};
