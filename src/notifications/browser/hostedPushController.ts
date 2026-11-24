import {z} from "zod";
import type {HostedPushTarget} from "../contracts/hostedPush";
import type {NotificationDelivery, NotificationPreferenceStore, NotificationProvider, NotificationSnapshot} from "../contracts/notificationProvider";
import {
  hostedPushApplicationKey,
  hostedPushPermission,
  hostedPushRegistration,
  hostedPushSupported,
  requestHostedPushPermission,
  serializeHostedPushSubscription,
  unsubscribeHostedPush,
  withHostedPushDeadline,
  withHostedPushMutation,
} from "./hostedPush/device";
import {
  hostedPushStorageKey,
  initializeHostedPushState,
  nextHostedPushRevision,
  readHostedPushState,
  saveHostedPushState,
  writeHostedPushGate,
  type HostedPushStoredState,
} from "./hostedPush/storage";
import type {HostedPushTransport, HostedPushTransportFactory} from "./hostedPush/transport";

type Operation = {generation: number; signal: AbortSignal};
const Receipt = z.object({installationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), revision: z.number().int().nonnegative().safe()}).strict();
const Locale = z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u);

/** Browser enrollment and opt-out, independent of the hosted service's deployment or framework. */
export function createHostedPushController({target, transport, workerPath, preferences, isAccountActive = () => true, launchPath = "/"}: {
  target: HostedPushTarget;
  transport?: HostedPushTransportFactory;
  workerPath?: string;
  preferences?: NotificationPreferenceStore;
  isAccountActive?: () => boolean;
  launchPath?: string;
}): NotificationProvider {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(target)) throw new Error("hosted-push-target-invalid");
  let active = true;
  let generation = 0;
  let abort = new AbortController();
  let state: HostedPushStoredState | null = null;
  let lastActivityAt = 0;
  let lastRecoveryAt = 0;
  let observing = false;
  let stopPreferences: (() => void) | undefined;
  const listeners = new Set<() => void>();
  let snapshot: NotificationSnapshot = {enabled: true, busy: false, delivery: hostedPushSupported() ? transport ? "inactive" : "not-configured" : "unsupported"};

  const publish = (delivery: NotificationDelivery, busy = false) => {
    const enabled = state?.enabled ?? snapshot.enabled;
    if (snapshot.enabled === enabled && snapshot.busy === busy && snapshot.delivery === delivery) return;
    snapshot = {enabled, busy, delivery};
    listeners.forEach(listener => listener());
  };
  const save = (next: HostedPushStoredState) => {
    saveHostedPushState(target, next);
    state = next;
    if (preferences && preferences.getEnabled() !== next.enabled) preferences.setEnabled(next.enabled);
  };
  const load = (): HostedPushStoredState => {
    const stored = initializeHostedPushState(target, {enabled: preferences?.getEnabled() ?? true});
    const enabled = preferences?.getEnabled() ?? stored.enabled;
    if (enabled !== stored.enabled) {
      const next = {...stored, enabled, revision: nextHostedPushRevision(stored), pendingRevocation: !enabled || stored.pendingRevocation};
      save(next);
      return next;
    }
    state = stored;
    return stored;
  };
  const begin = (): Operation => {
    abort.abort();
    abort = new AbortController();
    generation += 1;
    return {generation, signal: abort.signal};
  };
  const current = (operation: Operation) => active && generation === operation.generation && !operation.signal.aborted;
  const readDesired = () => {
    try {return isAccountActive() && (readHostedPushState(target)?.enabled ?? false);} catch {return false;}
  };
  const api = (stored: HostedPushStoredState): HostedPushTransport | null => transport?.({target, token: stored.token}) ?? null;
  const displayGate = (enabled: boolean, operation: Operation) => {
    const revision = state?.revision;
    const isCurrent = () => {
      if (!current(operation) || enabled && !isAccountActive()) return false;
      try {
        const stored = readHostedPushState(target);
        if (!stored) return !enabled;
        return stored.revision === revision && (!enabled || stored.enabled);
      } catch {return !enabled;}
    };
    return writeHostedPushGate(target, state?.installationId ?? null, enabled, isCurrent, launchPath);
  };

  const disable = async (operation: Operation): Promise<boolean> => {
    if (!state || !current(operation)) return false;
    const intent = state;
    let service: HostedPushTransport | null = null;
    try {service = api(intent);} catch { /* Local suppression still runs if a service adapter cannot initialize. */ }
    const results = await Promise.allSettled([
      displayGate(false, operation),
      service ? service.unsubscribe(intent.revision, operation.signal).then(value => {
        const receipt = Receipt.parse(value);
        return receipt.revision === intent.revision;
      }) : Promise.resolve(false),
      unsubscribeHostedPush({target, isCurrent: () => {
        try {return current(operation) && readHostedPushState(target)?.revision === intent.revision;} catch {return false;}
      }}),
    ]);
    if (!current(operation)) return false;
    const gateSaved = results[0].status === "fulfilled" && results[0].value;
    const serverSaved = results[1].status === "fulfilled" && results[1].value;
    const browserSaved = results[2].status === "fulfilled" && results[2].value;
    if (gateSaved && serverSaved && browserSaved) {
      const stored = load();
      if (stored.revision === intent.revision) save({...stored, pendingRevocation: false, installationId: null});
    }
    const success = gateSaved && serverSaved && browserSaved;
    publish(success ? "inactive" : transport ? "save-failed" : "not-configured");
    return Boolean(success);
  };

  const enroll = async (operation: Operation, permission: Promise<NotificationPermission>): Promise<boolean> => {
    const enrollment: {created: PushSubscription | null} = {created: null};
    try {
      const granted = await permission;
      if (!current(operation) || !state?.enabled || !readDesired()) return false;
      if (granted !== "granted") {
        publish(granted === "denied" ? "blocked" : "permission-required");
        return false;
      }
      const stored = load();
      if (!stored.enabled || !current(operation)) return false;
      const service = api(stored);
      if (!service) {publish("not-configured"); return false;}
      const configuration = await service.configuration(operation.signal);
      if (!current(operation) || !readDesired()) return false;
      const subscription = await withHostedPushMutation(target, async () => {
        if (!current(operation) || !readDesired()) return null;
        const registration = await hostedPushRegistration(workerPath);
        if (!current(operation) || !readDesired()) return null;
        const applicationServerKey = hostedPushApplicationKey(configuration.publicKey);
        let value = await withHostedPushDeadline(registration.pushManager.getSubscription());
        if (!current(operation) || !readDesired()) return null;
        if (value) {
          const existingKey = value.options.applicationServerKey;
          const bytes = existingKey ? new Uint8Array(existingKey) : null;
          if (!bytes || bytes.length !== applicationServerKey.length || bytes.some((byte, index) => byte !== applicationServerKey[index])) {
            await withHostedPushDeadline(value.unsubscribe());
            value = await withHostedPushDeadline(registration.pushManager.getSubscription());
            if (value) throw new Error("hosted-push-key-replacement-pending");
          }
        }
        if (!current(operation) || !readDesired()) return null;
        if (!value) {
          const pending = registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey});
          void pending.then(result => {
            if (!readDesired()) void withHostedPushMutation(target, async () => {
              if (!readDesired()) await result.unsubscribe().catch(() => false);
            });
          }, () => undefined);
          value = await withHostedPushDeadline(pending);
          enrollment.created = value;
        }
        if (!current(operation) || !readDesired()) {
          if (enrollment.created && !readDesired()) await enrollment.created.unsubscribe().catch(() => false);
          return null;
        }
        return value;
      });
      if (!subscription || !current(operation) || !readDesired()) return false;
      const latest = load();
      if (!latest.enabled) return false;
      const intent = {...latest, revision: nextHostedPushRevision(latest), pendingRevocation: true};
      save(intent);
      await displayGate(false, operation);
      if (!current(operation) || !readDesired()) return false;
      const receipt = Receipt.parse(await service.subscribe({revision: intent.revision, locale: intent.locale,
        subscription: serializeHostedPushSubscription(subscription)}, operation.signal));
      if (!current(operation) || !readDesired()) return false;
      if (receipt.revision !== intent.revision) throw new Error("hosted-push-receipt-retired");
      const beforeSave = load();
      if (beforeSave.revision !== intent.revision || !beforeSave.enabled) return false;
      save({...beforeSave, installationId: receipt.installationId, pendingRevocation: false});
      if (!await displayGate(true, operation)) throw new Error("hosted-push-display-gate-unavailable");
      if (!current(operation)) return false;
      publish("ready");
      return true;
    } catch {
      const failedSubscription = enrollment.created;
      if (failedSubscription) await withHostedPushMutation(target, async () => {
        if (current(operation) || !readDesired()) await failedSubscription.unsubscribe().catch(() => false);
      });
      if (current(operation)) {
        await displayGate(false, operation);
        publish("save-failed");
      }
      return false;
    }
  };

  const change = (enabled: boolean, permissionRequested: boolean): Promise<boolean> => {
    if (!active || enabled && !isAccountActive()) return Promise.resolve(false);
    const operation = begin();
    try {
      const stored = load();
      save({...stored, enabled, revision: nextHostedPushRevision(stored), pendingRevocation: enabled ? stored.pendingRevocation : true});
      publish(enabled ? snapshot.delivery : "inactive", true);
    } catch {
      return displayGate(false, operation).then(() => {
        if (current(operation)) publish("save-failed");
        return false;
      });
    }
    if (!enabled) return disable(operation);
    if (!hostedPushSupported()) {publish("unsupported"); return Promise.resolve(false);}
    if (!transport) {publish("not-configured"); return Promise.resolve(false);}
    const permission = permissionRequested ? requestHostedPushPermission() : Promise.resolve(hostedPushPermission());
    return enroll(operation, permission);
  };

  const restore = async (): Promise<void> => {
    if (!isAccountActive()) return;
    active = true;
    lastRecoveryAt = Date.now();
    const operation = begin();
    if (!observing && typeof window !== "undefined") {window.addEventListener("storage", onStorage); observing = true;}
    if (!stopPreferences && preferences) stopPreferences = preferences.subscribe(() => {
      const enabled = preferences.getEnabled();
      if (active && isAccountActive() && state?.enabled !== enabled) void change(enabled, false);
    });
    try {
      const stored = load();
      if (!stored.enabled || stored.pendingRevocation) {
        if (stored.pendingRevocation) {
          save({...stored, revision: nextHostedPushRevision(stored)});
          publish("inactive", true);
          const revoked = await disable(operation);
          if (!revoked || !current(operation)) return;
        } else {await displayGate(false, operation); publish("inactive");}
        if (!state?.enabled) return;
      }
      if (!hostedPushSupported()) {publish("unsupported"); return;}
      if (!transport) {publish("not-configured"); return;}
      const permission = hostedPushPermission();
      if (permission !== "granted") {publish(permission === "denied" ? "blocked" : "permission-required"); return;}
      publish("inactive", true);
      await enroll(operation, Promise.resolve(permission));
    } catch {if (current(operation)) {await displayGate(false, operation); publish("save-failed");}}
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== hostedPushStorageKey(target)) return;
    if (!active || !isAccountActive()) return;
    const operation = begin();
    try {
      const stored = readHostedPushState(target);
      if (!stored) {
        state = null;
        void displayGate(false, operation);
        void unsubscribeHostedPush({target, isCurrent: () => current(operation) && !readDesired()});
        publish("inactive");
        return;
      }
      state = stored;
      if (!stored.enabled) {
        void displayGate(false, operation);
        publish("inactive", stored.pendingRevocation);
        if (stored.pendingRevocation) void disable(operation);
      } else publish(hostedPushPermission() === "granted"
        ? stored.installationId && !stored.pendingRevocation ? "ready" : "inactive"
        : hostedPushPermission() === "denied" ? "blocked" : "permission-required");
    } catch {
      void displayGate(false, operation);
      void unsubscribeHostedPush({target, isCurrent: () => current(operation) && !readDesired()});
      publish("save-failed");
    }
  };
  return {
    getSnapshot: (): NotificationSnapshot => snapshot,
    subscribe(listener: () => void) {listeners.add(listener); return () => listeners.delete(listener);},
    restore,
    setEnabled(enabled: boolean) {return change(enabled, true);},
    requestPermission() {return change(true, true);},
    async recordActivity({locale}: {locale: string}): Promise<void> {
      if (!active || !isAccountActive()) return;
      let operation: Operation = {generation, signal: abort.signal};
      const parsed = Locale.safeParse(locale);
      if (!parsed.success) return;
      try {
        let stored = load();
        if (stored.locale !== parsed.data) save({...stored, locale: parsed.data});
        if (!snapshot.busy && transport && Date.now() - lastRecoveryAt >= 60_000 &&
            (stored.pendingRevocation || stored.enabled && hostedPushPermission() === "granted")) {
          await restore();
          if (!active) return;
          stored = load();
        }
        if (stored.enabled && snapshot.delivery === "ready" && hostedPushPermission() !== "granted") {
          save({...stored, revision: nextHostedPushRevision(stored), pendingRevocation: true});
          await restore();
          return;
        }
        if (!stored.enabled || snapshot.delivery !== "ready" || Date.now() - lastActivityAt < 60_000) return;
        const service = api(stored);
        if (!service) return;
        operation = {generation, signal: abort.signal};
        await service.activity(parsed.data, operation.signal);
        if (current(operation)) lastActivityAt = Date.now();
      } catch {if (current(operation) && isAccountActive()) publish("save-failed");}
    },
    retire() {
      active = false;
      begin();
      if (observing && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      observing = false;
      stopPreferences?.();
      stopPreferences = undefined;
    },
  };
}

export type {HostedPushTransport, HostedPushTransportFactory} from "./hostedPush/transport";
