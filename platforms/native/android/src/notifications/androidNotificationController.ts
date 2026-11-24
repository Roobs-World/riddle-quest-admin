import type {NotificationDelivery, NotificationProvider, NotificationSnapshot} from "../../../../../src/notifications/contracts/notificationProvider";

export type AndroidNotificationPreferences = Readonly<{enabled: boolean}>;
export type AndroidNotificationDevice = Readonly<{
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  configure(): Promise<void>;
  getToken(): Promise<string>;
  deviceId(): Promise<string>;
  beginAccountOperation(uid: string): Promise<number>;
  invalidateAccountOperation(uid: string): Promise<void>;
  knownToken?(): Promise<string | null>;
  setAccount(uid: string, preferences: AndroidNotificationPreferences, operationId: number, registrationRevision: number): Promise<void>;
  clearPendingToken?(token: string): Promise<void>;
}>;
export type AndroidSubscriptionInput = Readonly<{enabled: boolean; expectedOwnerId: string; deviceEpoch: number; deviceId: string; preferenceFromSettings: boolean}> | Readonly<{
  enabled: true; expectedOwnerId: string; deviceEpoch: number; deviceId: string; preferenceFromSettings: boolean; token: string; locale: string;
}> | Readonly<{enabled: false; expectedOwnerId: string; deviceEpoch: number; deviceId: string; preferenceFromSettings: boolean; token: string}>;
export type AndroidNotificationBackend = Readonly<{
  readPreference(expectedOwnerId: string): Promise<boolean | null>;
  setSubscription(input: AndroidSubscriptionInput): Promise<Readonly<{enabled: boolean; delivery: NotificationDelivery; registrationRevision: number}>>;
}>;
export type AndroidNotificationStorage = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}>;

/** Missing preferences default On; an explicitly saved legacy Off remains Off. */
export function parseAndroidNotificationPreferences(raw: string | null): AndroidNotificationPreferences {
  if (raw === null) return {enabled: true};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null) {
      if ("enabled" in value && typeof value.enabled === "boolean") return {enabled: value.enabled};
      if ("invitations" in value && "daily" in value && typeof value.invitations === "boolean" && typeof value.daily === "boolean")
        return {enabled: value.invitations || value.daily};
    }
  } catch { /* An unreadable saved preference never overrides a previous opt-out. */ }
  return {enabled: false};
}

/** The hosted service owns campaigns; this provider owns native permission and registration. */
export function createAndroidNotificationController(input: {
  uid: string; locale: string; device: AndroidNotificationDevice; backend: AndroidNotificationBackend; storage: AndroidNotificationStorage;
}): NotificationProvider {
  const key = `riddle-quest:android:notifications:${input.uid}`;
  let active = true, epoch = 0, changing = false, restoring = false, refreshQueued = false;
  let restoreProvider: () => Promise<void>;
  const drainRefresh = () => {
    if (active && refreshQueued && !changing && !restoring) {refreshQueued = false; void restoreProvider();}
  };
  let snapshot: NotificationSnapshot = {enabled: true, busy: false, delivery: "permission-required"};
  const listeners = new Set<() => void>();
  const publish = (next: NotificationSnapshot) => {
    if (next.enabled === snapshot.enabled && next.busy === snapshot.busy && next.delivery === snapshot.delivery) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const current = (revision: number) => active && epoch === revision;
  const assertCurrent = (revision: number) => {if (!current(revision)) throw new Error("notification-account-changed");};
  const persist = (enabled: boolean) => input.storage.setItem(key, JSON.stringify({enabled}));
  const reconcile = async (enabled: boolean, fromSettings: boolean, revision: number, operationId: number, deviceId: string): Promise<NotificationDelivery> => {
    if (!enabled) {
      await input.device.setAccount(input.uid, {enabled: false}, operationId, 0);
      assertCurrent(revision);
      const token = await input.device.knownToken?.();
      assertCurrent(revision);
      await input.backend.setSubscription({enabled: false, expectedOwnerId: input.uid, deviceEpoch: operationId, deviceId, preferenceFromSettings: fromSettings, ...(token ? {token} : {})});
      assertCurrent(revision);
      return "inactive";
    }
    const allowed = fromSettings ? await input.device.requestPermission() : await input.device.hasPermission();
    assertCurrent(revision);
    if (!allowed) {
      await input.device.setAccount(input.uid, {enabled: false}, operationId, 0);
      assertCurrent(revision);
      if (fromSettings) await input.backend.setSubscription({enabled: true, expectedOwnerId: input.uid, deviceEpoch: operationId, deviceId, preferenceFromSettings: true});
      assertCurrent(revision);
      return fromSettings ? "blocked" : "permission-required";
    }
    await input.device.configure();
    assertCurrent(revision);
    const token = await input.device.getToken();
    assertCurrent(revision);
    const result = await input.backend.setSubscription({enabled: true, expectedOwnerId: input.uid, deviceEpoch: operationId, deviceId, preferenceFromSettings: fromSettings, token, locale: input.locale});
    assertCurrent(revision);
    if (!result.enabled) {await persist(false); assertCurrent(revision);}
    await input.device.setAccount(input.uid, {enabled: result.enabled && result.delivery === "ready"}, operationId, result.registrationRevision);
    assertCurrent(revision);
    if (result.delivery === "ready") await input.device.clearPendingToken?.(token);
    assertCurrent(revision);
    return result.delivery;
  };
  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    if (!active || changing) return false;
    changing = true;
    if (restoring) refreshQueued = true;
    const revision = ++epoch;
    publish({enabled, busy: true, delivery: enabled ? snapshot.delivery : "inactive"});
    try {
      const operationId = await input.device.beginAccountOperation(input.uid);
      assertCurrent(revision);
      const deviceId = await input.device.deviceId();
      assertCurrent(revision);
      if (!enabled) {
        await input.device.setAccount(input.uid, {enabled: false}, operationId, 0);
        assertCurrent(revision);
      }
      await persist(enabled);
      assertCurrent(revision);
      const delivery = await reconcile(enabled, true, revision, operationId, deviceId);
      if (!current(revision)) return false;
      const savedEnabled = delivery === "inactive" ? false : enabled;
      publish({enabled: savedEnabled, busy: false, delivery});
      return savedEnabled === enabled && (delivery === "ready" || delivery === "inactive" || delivery === "not-configured");
    } catch {
      if (current(revision)) publish({enabled, busy: false, delivery: "save-failed"});
      return false;
    } finally {if (epoch === revision) changing = false; drainRefresh();}
  };
  restoreProvider = async () => {
      active = true;
      if (changing || restoring) {refreshQueued = true; return;}
      restoring = true;
      const revision = ++epoch;
      try {
        const operationId = await input.device.beginAccountOperation(input.uid);
        assertCurrent(revision);
        const deviceId = await input.device.deviceId();
        assertCurrent(revision);
        const local = parseAndroidNotificationPreferences(await input.storage.getItem(key));
        assertCurrent(revision);
        const remote = await input.backend.readPreference(input.uid);
        assertCurrent(revision);
        const enabled = local.enabled && remote !== false;
        if (!enabled) {
          await input.device.setAccount(input.uid, {enabled: false}, operationId, 0);
          assertCurrent(revision);
        }
        await persist(enabled);
        assertCurrent(revision);
        publish({enabled, busy: true, delivery: enabled ? snapshot.delivery : "inactive"});
        const delivery = await reconcile(enabled, false, revision, operationId, deviceId);
        if (current(revision)) publish({enabled: delivery === "inactive" ? false : enabled, busy: false, delivery});
      } catch {if (current(revision)) publish({...snapshot, busy: false, delivery: "save-failed"});}
      finally {restoring = false; drainRefresh();}
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
    restore: restoreProvider,
    setEnabled,
    requestPermission: () => setEnabled(true),
    async recordActivity() {},
    retire() {
      active = false; epoch += 1; changing = false; refreshQueued = false;
      void input.device.invalidateAccountOperation(input.uid).catch(() => undefined);
    },
  };
}
