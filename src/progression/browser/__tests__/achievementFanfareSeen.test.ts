import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {AchievementFanfareSeen, getAchievementFanfareOwnerKey} from "../achievementFanfareSeen";

/** Restores the test runner's browser surface after each storage scenario. */
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
/** Durable markers survive replacement presentation instances and isolated module reloads. */
const localValues = new Map<string, string>();
/** A restrictive iframe can reject writes while retaining readable older markers. */
let quotaBlocked = false;

beforeEach(() => {
  localValues.clear();
  quotaBlocked = false;
  Object.defineProperty(globalThis, "window", {configurable: true, value: {
    localStorage: {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (quotaBlocked) throw new DOMException("Full", "QuotaExceededError");
        localValues.set(key, value);
      },
    },
  }});
});

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("achievement fanfare consumption", () => {
  it("does not consume a queued achievement until its presentation claims it", () => {
    const user = {uid: "queued-achievement", isAnonymous: true, accountGeneration: 1};
    const markers = new AchievementFanfareSeen(user);
    expect(markers.hasSeen("first_win")).toBe(false);
    expect(markers.hasSeen("first_win")).toBe(false);
    expect(localValues.size).toBe(0);

    expect(markers.claim("first_win")).toBe(true);
    expect(markers.hasSeen("first_win")).toBe(true);
    expect(markers.claim("first_win")).toBe(false);
    expect(markers.hasSeen("perfect_guess")).toBe(false);
    expect([...localValues.values()]).toEqual(["seen"]);
  });

  it("shares consumed achievements across receipt instances and anonymous account linking", () => {
    const user = {uid: "shared-receipts", isAnonymous: true, accountGeneration: 1};
    const completion = new AchievementFanfareSeen(user);
    const purchase = new AchievementFanfareSeen(user);
    expect(completion.claim("first_win")).toBe(true);
    expect(purchase.claim("first_win")).toBe(false);
    expect(new AchievementFanfareSeen({...user, isAnonymous: false}).claim("first_win")).toBe(false);
    expect(purchase.claim("first_purchase")).toBe(true);
  });

  it("keeps different accounts and recreated generations independent", () => {
    const user = {uid: "account-scoping", isAnonymous: false, accountGeneration: 1};
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen({...user, uid: "replacement-account"}).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen({...user, accountGeneration: 2}).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(false);
  });

  it("reads saved consumption after the presentation module reloads", () => {
    const user = {uid: "durable-consumption", isAnonymous: false, accountGeneration: 1};
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(true);
    expect(localValues.size).toBe(1);

    jest.isolateModules(() => {
      const reloaded = jest.requireActual<typeof import("../achievementFanfareSeen")>("../achievementFanfareSeen");
      expect(new reloaded.AchievementFanfareSeen(user).hasSeen("first_win")).toBe(true);
      expect(new reloaded.AchievementFanfareSeen(user).claim("first_win")).toBe(false);
    });
  });

  it("keeps consumed achievements across remounts when storage writes fail", () => {
    quotaBlocked = true;
    const user = {uid: "quota-fallback", isAnonymous: true, accountGeneration: 1};
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(true);
    expect(localValues.size).toBe(0);
    expect(new AchievementFanfareSeen(user).hasSeen("first_win")).toBe(true);
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(false);
  });

  it("keeps consumed achievements across remounts when storage access is blocked", () => {
    Object.defineProperty(window, "localStorage", {get: () => {
      throw new DOMException("Blocked", "SecurityError");
    }});
    const user = {uid: "blocked-storage-fallback", isAnonymous: true, accountGeneration: 1};
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(false);
    expect(localValues.size).toBe(0);
  });

  it("keeps the explicit offline owner separate from a hosted account", () => {
    const user = {uid: "offline", isAnonymous: true};
    expect(getAchievementFanfareOwnerKey(null)).not.toBe(getAchievementFanfareOwnerKey(user));
    expect(new AchievementFanfareSeen(null).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen(user).claim("first_win")).toBe(true);
    expect(new AchievementFanfareSeen(null).claim("first_win")).toBe(false);
  });
});
