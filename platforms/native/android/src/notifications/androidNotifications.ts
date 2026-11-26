import {createAndroidPlayerStorage} from "../hosted/androidPlayerStorage";
import {AppState, DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform} from "react-native";
import {useEffect, useMemo, useRef} from "react";
import {
  createAndroidNotificationController,
  type AndroidNotificationBackend,
  type AndroidNotificationDevice,
} from "./androidNotificationController";
import {hostedConfig} from "../hosted/hostedConfig";
/** Validated native bridge. */
type NativeNotifications = {
  /** Initializes the native Android Firebase application for notification delivery. */
  configure(config: {
    /** Registered Firebase Android application identifier. */
    appId: string;
    /** Public Firebase client configuration key. */
    apiKey: string;
    /** Firebase project owning this Android registration. */
    projectId: string;
    /** Firebase Cloud Messaging sender project number. */
    senderId: string;
  }): Promise<unknown>;
  /** Reads the current SDK registration token, including token rotations. */
  getToken(): Promise<unknown>;
  /** Binds native display to the exact account and its selected consent. */
  deviceId(): Promise<unknown>;
  beginAccountOperation(uid: string): Promise<unknown>;
  invalidateAccountOperation(uid: string): Promise<unknown>;
  knownToken(): Promise<unknown>;
  setAccount(uid: string, enabled: boolean, operationId: number, registrationRevision: number): Promise<unknown>;
  pendingToken(): Promise<unknown>;
  clearPendingToken(expectedToken: string): Promise<unknown>;
  /** Atomically clears only the expected native owner and its displayed notifications. */
  clearAccount(expectedUid: string): Promise<unknown>;
};
/** Accepts only the module methods actually called by this adapter. */
function isNativeNotifications(value: unknown): value is NativeNotifications {
  return (
    typeof value === "object" &&
    value !== null &&
    "configure" in value &&
    typeof value.configure === "function" &&
    "getToken" in value &&
    typeof value.getToken === "function" &&
    "setAccount" in value &&
    typeof value.setAccount === "function" &&
    "deviceId" in value && typeof value.deviceId === "function" &&
    "beginAccountOperation" in value && typeof value.beginAccountOperation === "function" &&
    "invalidateAccountOperation" in value && typeof value.invalidateAccountOperation === "function" &&
    "knownToken" in value && typeof value.knownToken === "function" &&
    "pendingToken" in value && typeof value.pendingToken === "function" &&
    "clearPendingToken" in value && typeof value.clearPendingToken === "function" &&
    "clearAccount" in value &&
    typeof value.clearAccount === "function"
  );
}
/** Native Firebase registration and Android 13 permission bridge. */
export function createAndroidNotificationDevice(): AndroidNotificationDevice | null {
  /** Validated native bridge, with no authority to grant game currency. */
  const native: unknown = NativeModules.RiddleQuestNotifications;
  if (!isNativeNotifications(native)) return null;
  /** Reads existing OS permission without prompting the player. */
  const hasPermission = async () =>
    Platform.OS === "android" &&
    (Number(Platform.Version) < 33 ||
      (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)));
  return {
    hasPermission,
    /** Requests Android notification permission only after explicit player opt-in. */
    async requestPermission() {
      if (await hasPermission()) return true;
      return (
        (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    },
    /** Initializes the native Android Firebase application for notification delivery. */
    async configure() {
      /** Public Android Firebase configuration supplied to the native SDK. */
      const config = hostedConfig.firebase;
      if (!config.androidAppId) throw new Error("notification-config-unavailable");
      await native.configure({
        appId: config.androidAppId,
        apiKey: config.androidApiKey ?? config.apiKey,
        projectId: config.projectId,
        senderId: config.messagingSenderId,
      });
    },
    /** Reads the current SDK registration token, including token rotations. */
    async getToken() {
      /** Opaque provider token, never a local grant or account selector. */
      const token = await native.getToken();
      if (typeof token !== "string" || token.length < 20 || token.length > 4096 || !/^[A-Za-z0-9_:.-]+$/.test(token))
        throw new Error("notification-token-invalid");
      return token;
    },
    /** Binds native display to the exact account and its selected consent. */
    async deviceId() {
      const id = await native.deviceId();
      if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new Error("notification-device-invalid");
      return id;
    },
    async beginAccountOperation(uid) {
      const operationId = await native.beginAccountOperation(uid);
      if (typeof operationId !== "number" || !Number.isSafeInteger(operationId) || operationId < 1) throw new Error("notification-operation-invalid");
      return operationId;
    },
    async invalidateAccountOperation(uid) {await native.invalidateAccountOperation(uid);},
    async knownToken() {
      const token = await native.knownToken();
      return typeof token === "string" && token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9_:.-]+$/.test(token) ? token : null;
    },
    async setAccount(uid, preferences, operationId, registrationRevision) {
      if (!await native.setAccount(uid, preferences.enabled, operationId, registrationRevision)) throw new Error("notification-account-changed");
    },
    async clearPendingToken(token) {await native.clearPendingToken(token);},
  };
}
/** Clears a retired authenticated account without allowing stale work to clear a replacement. */
export async function clearAndroidNotificationAccount(expectedUid: string): Promise<void> {
  /** Only the native compare-and-clear bridge can retire a persisted notification owner. */
  const native: unknown = NativeModules.RiddleQuestNotifications;
  if (isNativeNotifications(native)) await native.clearAccount(expectedUid);
}
/** Binds persisted consent to the current account and refreshes rotated tokens on foreground. */
export function useAndroidNotifications(uid: string | null, locale: string, backend?: AndroidNotificationBackend) {
  /** Account-owned controller coordinating the device and authoritative backend. */
  const controller = useMemo(() => {
    /** Native notification capability, separate from game economy authority. */
    const device = createAndroidNotificationDevice();
    return uid && backend && device && hostedConfig.firebase.androidAppId
      ? createAndroidNotificationController({uid, locale, backend, device, storage: createAndroidPlayerStorage()})
      : null;
  }, [uid, locale, backend]);
  /** Last authenticated native owner; StrictMode cleanup alone never clears its consent. */
  const previousUid = useRef<string | null>(null);
  useEffect(() => {
    /** Account replacement retires only the previously observed uid. */
    const previous = previousUid.current;
    previousUid.current = uid;
    if (previous && previous !== uid) void clearAndroidNotificationAccount(previous).catch(() => undefined);
    if (!controller) {
      return;
    }
    /** Current account-owned snapshot or effect lifetime checked before applying work. */
    let current = true;
    /** Renews already-selected consent with the current token without another OS prompt. */
    const refresh = () => {
      if (current) controller.restore().catch(() => undefined);
    };
    refresh();
    /** OS lifecycle listener or current verified Play receipt. */
    const tokenSubscription = DeviceEventEmitter.addListener("riddleQuestNotificationTokenChanged", refresh);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      current = false;
      controller.retire();
      subscription.remove();
      tokenSubscription.remove();
    };
  }, [controller, uid]);
  return controller;
}
