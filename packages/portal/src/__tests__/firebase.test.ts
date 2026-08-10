const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_firestore: unknown, collection: string, id: string) => ({collection, id}));
const mockHttpsCallable = jest.fn((_functions: unknown, name: string) => Object.assign(jest.fn(), {callableName: name}));
const mockInitializeApp = jest.fn(() => ({name: "firebase-app"}));
const mockGetAuth = jest.fn(() => ({name: "auth"}));
const mockGetFirestore = jest.fn(() => ({name: "firestore"}));
const mockGetFunctions = jest.fn(() => ({name: "functions"}));
const mockInitializeAppCheck = jest.fn(() => ({name: "app-check"}));
const mockGetToken = jest.fn();
const mockSetTokenAutoRefreshEnabled = jest.fn();

jest.mock("firebase/app", () => ({initializeApp: (...args: unknown[]) => mockInitializeApp(...args)}));
jest.mock("firebase/app-check", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    public constructor(public readonly siteKey: string) {}
  },
  setTokenAutoRefreshEnabled: (...args: unknown[]) => mockSetTokenAutoRefreshEnabled(...args),
}));
jest.mock("firebase/auth", () => ({getAuth: (...args: unknown[]) => mockGetAuth(...args)}));
jest.mock("firebase/firestore/lite", () => ({
  doc: (...args: unknown[]) => mockDoc(...args as [unknown, string, string]),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
}));
jest.mock("firebase/functions", () => ({
  getFunctions: (...args: unknown[]) => mockGetFunctions(...args),
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

import {
  auth,
  ensureFirebaseAppCheckReady,
  firebaseApp,
  loadNotificationCopy,
  loadUserDocument,
} from "../firebase";

describe("Firebase browser adapter", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it("initializes Firebase once and declares every callable endpoint", () => {
    expect(firebaseApp).toEqual({name: "firebase-app"});
    expect(auth).toEqual({name: "auth"});
    expect(mockInitializeApp).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "missing-api-key",
      authDomain: "missing.firebaseapp.com",
      messagingSenderId: "0",
      projectId: "missing-project",
    }));
    expect(mockGetFunctions).toHaveBeenCalledWith(firebaseApp, "us-central1");
    expect(mockHttpsCallable.mock.calls.map((call) => call[1])).toEqual([
      "getCurrentDailyChallenge",
      "getCurrentClassicRiddle",
      "completeGame",
      "getHint",
      "spendCoins",
      "skipRiddle",
      "getLeaderboard",
      "updateUsername",
      "updateAvatar",
      "deleteAccount",
      "listRaceCategories",
      "startRaceRun",
      "submitRaceGuess",
      "requestRaceHint",
      "skipRaceRiddle",
      "resumeRaceRun",
      "abandonRaceRun",
      "publishRaceChallenge",
      "getRaceChallenge",
      "getRaceOutcome",
      "listRaceInbox",
      "getRaceAccess",
      "recordRaceAnalytics",
    ]);
  });

  it("attests before enabling App Check token refresh", async () => {
    mockGetToken.mockResolvedValue({token: "attested"});
    await expect(ensureFirebaseAppCheckReady()).resolves.toBeUndefined();
    expect(mockGetToken).toHaveBeenCalledWith(expect.anything());
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("loads existing user documents and returns null for missing users", async () => {
    mockGetDoc
      .mockResolvedValueOnce({exists: () => true, data: () => ({username: "Ada"})})
      .mockResolvedValueOnce({exists: () => false});

    await expect(loadUserDocument("user-1")).resolves.toEqual({username: "Ada"});
    await expect(loadUserDocument("user-2")).resolves.toBeNull();
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1");
  });

  it("requires notification configuration", async () => {
    mockGetDoc.mockResolvedValue({exists: () => false});
    await expect(loadNotificationCopy("en")).rejects.toThrow("Firestore notification copy is not configured.");
  });

  it("parses localized notification configuration", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({locales: {en: {
        dailyBody: "A new puzzle is ready",
        dailyCta: "Play",
        streakBody: "Keep your streak alive",
        streakCta: "Continue",
        weeklyBody: "A weekly puzzle is ready",
        weeklyCta: "Solve",
        raceTitle: "Race to 10",
        raceBody: "A race result is ready",
        raceCta: "View",
      }}}),
    });

    await expect(loadNotificationCopy("en")).resolves.toEqual(expect.any(Object));
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "config", "notifications");
  });
});

describe("Firebase environment variants", () => {
  const completeEnvironment = {
    apiKey: "api-key",
    appId: "app-id",
    authDomain: "example.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "project-id",
    measurementId: "G-PROVIDED",
    appCheckSiteKey: undefined,
    functionsRegion: "europe-west2",
    jestRuntime: "0",
    production: false,
  } as const;

  const loadWithEnvironment = async (
    environment: typeof completeEnvironment | Record<string, unknown>,
    search?: string,
  ) => {
    jest.doMock("../test/firebaseEnvironmentMock", () => ({firebaseEnvironment: environment}));
    if (search !== undefined) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {location: {search}},
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    let loaded: typeof import("../firebase") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../firebase");
    });
    return loaded!;
  };

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    jest.dontMock("../test/firebaseEnvironmentMock");
  });

  it("uses provided configuration and region values", async () => {
    mockInitializeApp.mockClear();
    mockGetFunctions.mockClear();
    const module = await loadWithEnvironment(completeEnvironment);

    expect(module.firebaseApp).toEqual({name: "firebase-app"});
    expect(mockInitializeApp).toHaveBeenCalledWith({
      apiKey: "api-key",
      appId: "app-id",
      authDomain: "example.firebaseapp.com",
      messagingSenderId: "123",
      projectId: "project-id",
      measurementId: "G-PROVIDED",
    });
    expect(mockGetFunctions).toHaveBeenCalledWith(module.firebaseApp, "europe-west2");
    await expect(module.ensureFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("does not initialize App Check on a trusted harness route", async () => {
    mockInitializeAppCheck.mockClear();
    const module = await loadWithEnvironment({...completeEnvironment, appCheckSiteKey: "site-key"}, "?harness=race");
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    await expect(module.ensureFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("initializes App Check when a browser URL has no harness marker", async () => {
    mockInitializeAppCheck.mockClear();
    mockGetToken.mockResolvedValue({token: "attested"});
    const module = await loadWithEnvironment({...completeEnvironment, appCheckSiteKey: "site-key"}, "?source=jest");
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    await expect(module.ensureFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("fails closed when a production Jest build has no App Check key", async () => {
    const module = await loadWithEnvironment({
      ...completeEnvironment,
      appCheckSiteKey: undefined,
      jestRuntime: "1",
      production: true,
    });
    await expect(module.ensureFirebaseAppCheckReady()).rejects.toThrow("not configured for the Jest build");
  });
});
