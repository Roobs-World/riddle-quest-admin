/** Explicit consent retained independently for each Global Game Account on this device. */
export type AndroidNotificationPreferences = Readonly<{
  /** Whether this account explicitly accepts race invitation notifications. */
  invitations: boolean;
  /** Whether this account explicitly accepts the Daily reminder. */
  daily: boolean;
}>;
/** Native device capability; no other target's SDK enters this port. */
export type AndroidNotificationDevice = Readonly<{
  /** Requests Android notification permission only after explicit player opt-in. */
  requestPermission(): Promise<boolean>;
  /** Reads existing OS permission without prompting the player. */
  hasPermission(): Promise<boolean>;
  /** Initializes the native Android Firebase application for notification delivery. */
  configure(): Promise<void>;
  /** Reads the current SDK registration token, including token rotations. */
  getToken(): Promise<string>;
  /** Binds native display to the exact account and its selected consent. */
  setAccount(uid: string, preferences: AndroidNotificationPreferences): Promise<void>;
}>;
/** Authenticated Android-only callable adapter. */
export type AndroidNotificationBackend = Readonly<{
  /** Records explicit native consent at the authenticated backend boundary. */
  setSubscription(
    input: AndroidNotificationPreferences & {
      /** Opaque provider token, never a local grant or account selector. */
      token: string;
      /** Supported recipient language used for notification or referral copy. */
      locale: string;
    },
  ): Promise<AndroidNotificationPreferences>;
}>;
/** App-private preference storage. */
export type AndroidNotificationStorage = Readonly<{
  /** Reads one account-scoped app-private preference record. */
  getItem(key: string): Promise<string | null>;
  /** Persists one account-scoped app-private preference record. */
  setItem(key: string, value: string): Promise<unknown>;
}>;
/** Reads only persisted booleans; malformed local preferences never imply consent. */
export function parseAndroidNotificationPreferences(raw: string | null): AndroidNotificationPreferences {
  try {
    /** Untrusted local bytes parsed before they can imply notification consent. */
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      typeof value === "object" &&
      value !== null &&
      "invitations" in value &&
      "daily" in value &&
      typeof value.invitations === "boolean" &&
      typeof value.daily === "boolean"
    )
      return {invitations: value.invitations, daily: value.daily};
  } catch {
    /* No notification consent follows a corrupt local record. */
  }
  return {invitations: false, daily: false};
}
/** Coordinates permission, device ownership, durable consent and token renewal. */
export function createAndroidNotificationController(input: {
  /** Authenticated game account that owns this operation. */
  uid: string;
  /** Supported recipient language used for notification or referral copy. */
  locale: string;
  /** Native notification capability, separate from game economy authority. */
  device: AndroidNotificationDevice;
  /** Authenticated provider-specific server operations. */
  backend: AndroidNotificationBackend;
  /** App-private persistence used only for recovery and explicit preferences. */
  storage: AndroidNotificationStorage;
}) {
  /** Account and command revision that invalidates stale asynchronous replies. */
  let epoch = 0,
    updating = false;
  /** Stops a retired account or superseded consent command from changing native delivery. */
  const assertCurrent = (expected: number) => {
    if (epoch !== expected) throw new Error("notification-account-changed");
  };
  /** Account-scoped app-private consent key. */
  const key = `riddle-quest:android:notifications:${input.uid}`;
  /** Loads only validated notification consent booleans from app-private storage. */
  const read = async () => parseAndroidNotificationPreferences(await input.storage.getItem(key));
  /** Reconciles explicit consent with OS permission, token ownership and the backend. */
  const update = async (preferences: AndroidNotificationPreferences, requestPermission: boolean) => {
    /** Frozen command revision checked after asynchronous provider boundaries. */
    const expected = epoch;
    /** Whether at least one notification purpose remains explicitly selected. */
    const enabled = preferences.invitations || preferences.daily;
    if (enabled) {
      /** Current Android notification permission decision. */
      const allowed = requestPermission ? await input.device.requestPermission() : await input.device.hasPermission();
      assertCurrent(expected);
      if (!allowed) {
        await input.device.setAccount(input.uid, {invitations: false, daily: false});
        throw new Error("notification-permission-denied");
      }
    }
    // Disable local delivery before a possibly failing server revocation.
    if (!enabled) {
      await input.device.setAccount(input.uid, preferences);
      await input.storage.setItem(key, JSON.stringify(preferences));
    }
    assertCurrent(expected);
    await input.device.configure();
    /** Opaque provider token, never a local grant or account selector. */
    const token = await input.device.getToken();
    assertCurrent(expected);
    await input.backend.setSubscription({...preferences, locale: input.locale, token});
    assertCurrent(expected);
    await input.device.setAccount(input.uid, preferences);
    await input.storage.setItem(key, JSON.stringify(preferences));
    return preferences;
  };
  return {
    read,
    /** Retires pending work before another account or consent command takes ownership. */
    invalidate() {
      epoch += 1;
    },
    /** Reconciles explicit consent with OS permission, token ownership and the backend. */
    async update(preferences: AndroidNotificationPreferences) {
      /** Frozen command revision checked after asynchronous provider boundaries. */
      const expected = ++epoch;
      updating = true;
      try {
        return await update(preferences, true);
      } finally {
        if (epoch === expected) updating = false;
      }
    },
    /** Renews already-selected consent with the current token without another OS prompt. */
    async refresh() {
      if (updating) return read();
      /** Frozen command revision checked after asynchronous provider boundaries. */
      const expected = epoch;
      /** Explicit invitation and Daily consent for the current game account. */
      const preferences = await read();
      assertCurrent(expected);
      await input.device.setAccount(input.uid, preferences);
      if (preferences.invitations || preferences.daily) await update(preferences, false);
      return preferences;
    },
  };
}
