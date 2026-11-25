import {webcrypto} from "node:crypto";
import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {createFirebaseNotificationEnrollment, type FirebaseEnrollmentBackend} from "../firebaseEnrollment";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
const accountId = "jest-test-account";
const managerOrigin = "https://notifications.example";
const pairingCode = "a".repeat(64);
const now = 1_800_000_000_000;
const validLink = {url: `${managerOrigin}/push/#pair=${pairingCode}`, expiresAtMs: now + 600_000};
const enrollments: Array<ReturnType<typeof createFirebaseNotificationEnrollment>> = [];

/** Supplies only browser capabilities used by the real enrollment controller. */
function enrollmentFixture() {
  jest.spyOn(Date, "now").mockReturnValue(now);
  const stored = new Map<string, string>();
  const storage: Storage = {
    get length() {return stored.size;},
    clear: () => {stored.clear();},
    getItem: key => stored.get(key) ?? null,
    key: index => Array.from(stored.keys())[index] ?? null,
    removeItem: key => {stored.delete(key);},
    setItem: (key, value) => {stored.set(key, value);},
  };
  const open = jest.fn<Window["open"]>().mockReturnValue(null);
  Object.defineProperty(globalThis, "window", {configurable: true, value: Object.assign(new EventTarget(), {localStorage: storage, open})});
  Object.defineProperty(globalThis, "crypto", {configurable: true, value: webcrypto});
  const backend = {
    createEnrollment: jest.fn<FirebaseEnrollmentBackend["createEnrollment"]>().mockResolvedValue(validLink),
    getEnrollmentStatus: jest.fn<FirebaseEnrollmentBackend["getEnrollmentStatus"]>()
      .mockResolvedValue({registeredDevices: 0, enrollmentComplete: false}),
  };
  let accountCurrent = true;
  const enrollment = createFirebaseNotificationEnrollment({
    accountId,
    managerOrigin,
    locale: () => "en",
    isCurrent: () => accountCurrent,
    backend,
  });
  enrollments.push(enrollment);
  enrollment.activate();
  return {enrollment, backend, open, stored, replaceAccount: () => {accountCurrent = false;}};
}

afterEach(() => {
  enrollments.splice(0).forEach(enrollment => enrollment.retire());
  jest.restoreAllMocks();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
  else Reflect.deleteProperty(globalThis, "crypto");
});

describe("Firebase notification enrollment inside a sandboxed host", () => {
  test.each(["returns null", "throws"])("provides manual setup when opening a popup %s", async popupFailure => {
    const {enrollment, backend, open, stored} = enrollmentFixture();
    if (popupFailure === "throws") open.mockImplementation(() => {throw new DOMException("Sandbox denies popups", "SecurityError");});
    expect(backend.createEnrollment).not.toHaveBeenCalled();
    expect(enrollment.getSetupLink()).toBeNull();

    await expect(enrollment.requestPermission()).resolves.toBe(true);

    expect(open).toHaveBeenCalledTimes(1);
    expect(backend.createEnrollment).toHaveBeenCalledWith({locale: "en"});
    expect(enrollment.getSetupLink()).toEqual(validLink);
    expect(stored.get(`riddleQuest:notificationEnrollment:${accountId}`)).toBe(pairingCode);
  });

  test.each([
    {label: "a foreign origin", link: {...validLink, url: `https://foreign.example/push/#pair=${pairingCode}`}},
    {label: "an expired link", link: {...validLink, expiresAtMs: now - 1}},
  ])("never exposes $label as a manual setup handoff", async ({link}) => {
    const {enrollment, backend, stored} = enrollmentFixture();
    backend.createEnrollment.mockResolvedValue(link);

    await expect(enrollment.requestPermission()).resolves.toBe(false);

    expect(enrollment.getSetupLink()).toBeNull();
    expect(stored.has(`riddleQuest:notificationEnrollment:${accountId}`)).toBe(false);
  });

  test("clears the handoff when returning to the game confirms manual enrollment", async () => {
    const {enrollment, backend} = enrollmentFixture();
    await enrollment.requestPermission();
    expect(enrollment.getSetupLink()).toEqual(validLink);
    backend.getEnrollmentStatus.mockResolvedValue({registeredDevices: 1, enrollmentComplete: true});

    await expect(enrollment.restoreDelivery()).resolves.toBe("ready");

    expect(backend.getEnrollmentStatus).toHaveBeenCalledWith({pairingCode});
    expect(enrollment.getSetupLink()).toBeNull();
  });

  test("stops exposing a link after its expiry", async () => {
    const {enrollment} = enrollmentFixture();
    await enrollment.requestPermission();
    jest.spyOn(Date, "now").mockReturnValue(validLink.expiresAtMs + 1);
    expect(enrollment.getSetupLink()).toBeNull();
  });

  test("clears the handoff and stops requests when its enrollment controller retires", async () => {
    const {enrollment, backend} = enrollmentFixture();
    await enrollment.requestPermission();
    enrollment.retire();

    expect(enrollment.getSetupLink()).toBeNull();
    await expect(enrollment.requestPermission()).resolves.toBe(false);
    expect(backend.createEnrollment).toHaveBeenCalledTimes(1);
  });

  test("does not expose the previous account's setup link after account replacement", async () => {
    const {enrollment, replaceAccount} = enrollmentFixture();
    await enrollment.requestPermission();
    replaceAccount();
    expect(enrollment.getSetupLink()).toBeNull();
    await expect(enrollment.restoreDelivery()).resolves.toBe("inactive");
  });

  test("retiring a blocked-popup request cannot publish its link or unlock a newer request", async () => {
    const {enrollment, backend, stored} = enrollmentFixture();
    let completeOldRequest: ((value: unknown) => void) | undefined;
    let completeNewRequest: ((value: unknown) => void) | undefined;
    const oldResponse = new Promise<unknown>(resolve => {completeOldRequest = resolve;});
    const newResponse = new Promise<unknown>(resolve => {completeNewRequest = resolve;});
    const nextCode = "b".repeat(64);
    const nextLink = {...validLink, url: `${managerOrigin}/push/#pair=${nextCode}`};
    backend.createEnrollment.mockReturnValueOnce(oldResponse).mockReturnValueOnce(newResponse);

    const oldRequest = enrollment.requestPermission();
    enrollment.retire();
    enrollment.activate();
    const newRequest = enrollment.requestPermission();
    expect(backend.createEnrollment).toHaveBeenCalledTimes(2);

    completeOldRequest?.(validLink);
    await expect(oldRequest).resolves.toBe(false);
    expect(enrollment.getSetupLink()).toBeNull();
    expect(stored.has(`riddleQuest:notificationEnrollment:${accountId}`)).toBe(false);
    await expect(enrollment.requestPermission()).resolves.toBe(false);
    expect(backend.createEnrollment).toHaveBeenCalledTimes(2);

    completeNewRequest?.(nextLink);
    await expect(newRequest).resolves.toBe(true);
    expect(enrollment.getSetupLink()).toEqual(nextLink);
    expect(stored.get(`riddleQuest:notificationEnrollment:${accountId}`)).toBe(nextCode);
  });

  test("an old pairing status cannot confirm or clear the newer setup link", async () => {
    const {enrollment, backend, stored} = enrollmentFixture();
    await enrollment.requestPermission();
    let completeOldStatus: ((value: unknown) => void) | undefined;
    const oldStatusResponse = new Promise<unknown>(resolve => {completeOldStatus = resolve;});
    backend.getEnrollmentStatus.mockReturnValueOnce(oldStatusResponse);
    const oldStatus = enrollment.restoreDelivery();
    expect(backend.getEnrollmentStatus).toHaveBeenCalledWith({pairingCode});

    const nextCode = "b".repeat(64);
    const nextLink = {...validLink, url: `${managerOrigin}/push/#pair=${nextCode}`};
    backend.createEnrollment.mockResolvedValue(nextLink);
    await expect(enrollment.requestPermission()).resolves.toBe(true);
    expect(enrollment.getSetupLink()).toEqual(nextLink);

    completeOldStatus?.({registeredDevices: 1, enrollmentComplete: true});
    await expect(oldStatus).resolves.toBe("permission-required");
    expect(enrollment.getSetupLink()).toEqual(nextLink);
    expect(stored.get(`riddleQuest:notificationEnrollment:${accountId}`)).toBe(nextCode);
    await expect(enrollment.restoreDelivery()).resolves.toBe("permission-required");
    expect(backend.getEnrollmentStatus).toHaveBeenLastCalledWith({pairingCode: nextCode});
  });
});
