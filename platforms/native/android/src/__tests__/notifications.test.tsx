import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {render, screen, fireEvent, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {NativeModules, PermissionsAndroid, Platform} from "react-native";
import {createAndroidNotificationController} from "../notifications/androidNotificationController";
import {clearAndroidNotificationAccount, createAndroidNotificationDevice} from "../notifications/androidNotifications";
import {HostedNotificationScreen} from "../screens/HostedNotificationScreen";
import {notificationCopy} from "../i18n/notificationCopy";
import {YOUTUBE_COPY} from "../../../../../src/localization/copy/localGameCopy";
import {resolveYouTubeLocale} from "../../../../../src/content/catalog/bundledContent";

jest.mock("../hosted/hostedConfig", () => ({
  hostedConfig: {
    firebase: {
      androidAppId: "1:123:android:abcdef",
      apiKey: "public-key",
      projectId: "demo-native-notifications",
      messagingSenderId: "123",
    },
  },
}));
/** Original native module descriptor restored after the bridge scenario. */
const originalNative = Object.getOwnPropertyDescriptor(NativeModules, "RiddleQuestNotifications");
/** Original platform descriptors restored after permission scenarios. */
const originalOS = Object.getOwnPropertyDescriptor(Platform, "OS"),
  originalVersion = Object.getOwnPropertyDescriptor(Platform, "Version");
afterEach(() => {
  if (originalNative) Object.defineProperty(NativeModules, "RiddleQuestNotifications", originalNative);
  else Reflect.deleteProperty(NativeModules, "RiddleQuestNotifications");
  if (originalOS) Object.defineProperty(Platform, "OS", originalOS);
  if (originalVersion) Object.defineProperty(Platform, "Version", originalVersion);
  jest.restoreAllMocks();
});
/** Installs a scripted native bridge while retaining real JS validation. */
function nativeModule(token: unknown = "native-fcm-registration-token") {
  /** Scripted native Firebase and consent methods exposed to the adapter. */
  const module = {
    configure: jest.fn(async (_input: unknown) => undefined),
    getToken: jest.fn(async () => token),
    setAccount: jest.fn(async (..._input: unknown[]) => undefined),
    /** Compare-and-clear native operation used during authenticated account retirement. */
    clearAccount: jest.fn(async (_expected: string) => true),
  };
  Object.defineProperty(NativeModules, "RiddleQuestNotifications", {configurable: true, value: module});
  Object.defineProperty(Platform, "OS", {configurable: true, value: "android"});
  Object.defineProperty(Platform, "Version", {configurable: true, value: 33});
  return module;
}
describe("Android notification adapter", () => {
  it("reports a missing or malformed native bridge", () => {
    Reflect.deleteProperty(NativeModules, "RiddleQuestNotifications");
    expect(createAndroidNotificationDevice()).toBeNull();
    Object.defineProperty(NativeModules, "RiddleQuestNotifications", {configurable: true, value: {getToken: true}});
    expect(createAndroidNotificationDevice()).toBeNull();
  });
  it("requests Android permission only when needed and configures the native Android Firebase app", async () => {
    /** Validated native bridge, with no authority to grant game currency. */
    const native = nativeModule();
    /** OS permission check observed independently of a permission prompt. */
    const check = jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(false);
    /** OS permission request triggered only by explicit enable. */
    const request = jest.spyOn(PermissionsAndroid, "request").mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    /** Native notification capability, separate from game economy authority. */
    const device = createAndroidNotificationDevice();
    if (!device) throw new Error("Native fixture absent");
    expect(await device.requestPermission()).toBe(false);
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    check.mockResolvedValue(true);
    expect(await device.requestPermission()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    await device.configure();
    expect(native.configure).toHaveBeenCalledWith({
      appId: "1:123:android:abcdef",
      apiKey: "public-key",
      projectId: "demo-native-notifications",
      senderId: "123",
    });
    expect(await device.getToken()).toBe("native-fcm-registration-token");
    await device.setAccount("new-account", {invitations: false, daily: false});
    expect(native.setAccount).toHaveBeenCalledWith("new-account", false, false);
  });
  it("rejects invalid registration tokens received from native code", async () => {
    for (const token of [null, 42, "", "token with spaces and punctuation!"]) {
      nativeModule(token);
      await expect(createAndroidNotificationDevice()?.getToken()).rejects.toThrow("notification-token-invalid");
    }
  });
});

/** Notification UI uses the real shared controller and in-memory device/backend ports. */
function fixture() {
  /** App-private persistence used only for recovery and explicit preferences. */
  const storage = new Map<string, string>();
  /** Scripted Android permission decision and provider failure state. */
  let permission = true,
    fail = false;
  /** Provider requests recorded independently from displayed consent. */
  const sent: unknown[] = [];
  /** Account-owned controller coordinating the device and authoritative backend. */
  const controller = createAndroidNotificationController({
    uid: "player",
    locale: "en",
    device: {
      requestPermission: async () => permission,
      hasPermission: async () => permission,
      configure: async () => undefined,
      getToken: async () => "native-fcm-registration-token",
      setAccount: async () => undefined,
    },
    backend: {
      /** Records explicit native consent at the authenticated backend boundary. */
      async setSubscription(input) {
        if (fail) throw new Error("offline");
        sent.push(input);
        return input;
      },
    },
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => {
        storage.set(key, value);
      },
    },
  });
  return {
    controller,
    sent,
    /** Changes the next Android permission decision in this scenario. */
    setPermission(value: boolean) {
      permission = value;
    },
    /** Makes the provider boundary unavailable without changing local consent. */
    setFailure(value: boolean) {
      fail = value;
    },
  };
}
/** Renders the native settings screen over safe-area metrics. */
const show = (controller: ReturnType<typeof createAndroidNotificationController> | null) =>
  render(
    <SafeAreaProvider>
      <HostedNotificationScreen locale="en" controller={controller} onBack={() => undefined} />
    </SafeAreaProvider>,
  );

describe("Android notification settings", () => {
  it("explains an unavailable capability and keeps every locale's keys complete", async () => {
    await show(null);
    expect(screen.getByText(notificationCopy("en").unavailable)).toBeVisible();
    for (const locale of Object.keys(YOUTUBE_COPY).map(resolveYouTubeLocale))
      expect(Object.keys(notificationCopy(locale))).toEqual(Object.keys(notificationCopy("en")));
  });
  it("requires permission and lets the player retry before saving invitation consent", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    f.setPermission(false);
    await show(f.controller);
    await waitFor(() => expect(screen.getByTestId("notification-invitations")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("notification-invitations"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(notificationCopy("en").failed));
    expect(f.sent).toEqual([]);
    f.setPermission(true);
    await fireEvent.press(screen.getByTestId("notification-invitations"));
    await waitFor(() => expect(screen.getByTestId("notification-invitations")).toHaveTextContent("Disable"));
    expect(await f.controller.read()).toEqual({invitations: true, daily: false});
  });
  it("offers separate Daily consent and reflects a locally saved revocation despite an outage", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await show(f.controller);
    await waitFor(() => expect(screen.getByTestId("notification-daily")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("notification-daily"));
    await waitFor(() => expect(screen.getByTestId("notification-daily")).toHaveTextContent("Disable"));
    expect(await f.controller.read()).toEqual({invitations: false, daily: true});
    f.setFailure(true);
    await fireEvent.press(screen.getByTestId("notification-daily"));
    await waitFor(() => expect(screen.getByTestId("notification-daily")).toHaveTextContent("Enable"));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(await f.controller.read()).toEqual({invitations: false, daily: false});
  });
});

/** Native owner retirement is conditional, so an obsolete sign-out cannot clear a replacement. */
it("clears only the retired native notification account", async () => {
  /** Persisted native owner and its compare-and-clear bridge. */
  let owner = "replacement";
  /** Validated native bridge, with no authority to grant game currency. */
  const native = nativeModule();
  native.clearAccount.mockImplementation(async (expected) => {
    if (owner !== expected) return false;
    owner = "";
    return true;
  });
  await clearAndroidNotificationAccount("retired");
  expect(owner).toBe("replacement");
  await clearAndroidNotificationAccount("replacement");
  expect(owner).toBe("");
});
