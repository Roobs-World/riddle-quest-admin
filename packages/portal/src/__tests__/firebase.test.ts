/** Provides mock get doc behavior. */
const mockGetDoc = jest.fn();
/** Provides mock doc behavior. */
const mockDoc = jest.fn((_firestore: unknown, collection: string, id: string) => ({collection, id}));
/** Provides mock https callable behavior. */
const mockHttpsCallable = jest.fn((_functions: unknown, name: string) =>
  Object.assign(jest.fn(), {callableName: name}),
);
/** Provides mock initialize app behavior. */
const mockInitializeApp = jest.fn(() => ({name: "firebase-app"}));
/** Provides mock get auth behavior. */
const mockGetAuth = jest.fn(() => ({name: "auth"}));
/** Per-frame authentication avoids another Jest player replacing this tab. */
const mockInitializeAuth = jest.fn(() => ({name: "frame-auth"}));
/** Controlled in-memory auth persistence isolates restricted browser storage. */
const mockInMemoryPersistence = {type: "NONE"};
/** Provides mock get firestore behavior. */
const mockGetFirestore = jest.fn(() => ({name: "firestore"}));
/** Provides mock get functions behavior. */
const mockGetFunctions = jest.fn((_app?: unknown, region?: string) => ({name: "functions", region}));

jest.mock("firebase/app", () => ({initializeApp: (...args: unknown[]) => mockInitializeApp(...args)}));
jest.mock("firebase/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  initializeAuth: (...args: unknown[]) => mockInitializeAuth(...args),
  inMemoryPersistence: mockInMemoryPersistence,
}));
jest.mock("firebase/firestore/lite", () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
}));
jest.mock("firebase/functions", () => ({
  getFunctions: (...args: unknown[]) => mockGetFunctions(...args),
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

import {auth, firebaseApp, loadUserDocument} from "../firebase";

describe("Firebase browser adapter", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it("initializes Firebase once and declares every callable endpoint", () => {
    expect(firebaseApp).toEqual({name: "firebase-app"});
    expect(auth).toEqual({name: "frame-auth"});
    expect(mockInitializeAuth).toHaveBeenCalledWith(firebaseApp, {persistence: mockInMemoryPersistence});
    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "missing-api-key",
        authDomain: "missing.firebaseapp.com",
        messagingSenderId: "0",
        projectId: "missing-project",
      }),
    );
    expect(mockGetFunctions).toHaveBeenCalledWith(firebaseApp, "us-central1");
    expect(mockHttpsCallable.mock.calls.map((call) => call[1])).toEqual([
      "createYahooStripeCheckout",
      "confirmYahooStripeCheckout",
      "getCurrentDailyChallenge",
      "getCurrentClassicRiddle",
      "getClassicRiddleBuffer",
      "completeGame",
      "submitSinglePlayerGuess",
      "getHint",
      "spendCoins",
      "skipRiddle",
      "getLeaderboard",
      "updateUsername",
      "updateAvatar",
      "syncJestAvatar",
      "deleteAccount",
      "setPresenceConsent",
      "listRaceCategories",
      "startRaceRun",
      "readyRaceRun",
      "findRaceMatch",
      "submitRaceGuess",
      "requestRaceHint",
      "skipRaceRiddle",
      "resumeRaceRun",
      "abandonRaceRun",
      "publishRaceChallenge",
      "reserveRaceInvite",
      "getRaceChallenge",
      "getRaceOutcome",
      "listRaceInbox",
      "blockRival",
      "reportRival",
      "getRaceAccess",
      "recordRaceAnalytics",
      "getRaceEntry",
      "cancelRaceInvite",
      "joinLiveRace",
      "updateLiveRace",
      "getLiveRaceChallenge",
    ]);
  });

  it("loads existing user documents and returns null for missing users", async () => {
    mockGetDoc
      .mockResolvedValueOnce({exists: () => true, data: () => ({username: "Ada"})})
      .mockResolvedValueOnce({exists: () => false});

    await expect(loadUserDocument("user-1")).resolves.toEqual({username: "Ada"});
    await expect(loadUserDocument("user-2")).resolves.toBeNull();
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1");
  });
});

describe("Firebase environment variants", () => {
  /** Completes environment. */
  const completeEnvironment = {
    apiKey: "api-key",
    appId: "app-id",
    authDomain: "example.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "project-id",
    measurementId: "G-PROVIDED",
    functionsRegion: "europe-west2",
  } as const;

  /** Loads with environment. */
  const loadWithEnvironment = async (environment: typeof completeEnvironment | Record<string, unknown>) => {
    jest.doMock("../test/firebaseEnvironmentMock", () => ({firebaseEnvironment: environment}));
    /** Loads ed. */
    let loaded: typeof import("../firebase") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../firebase");
    });
    return loaded!;
  };

  afterEach(() => {
    jest.dontMock("../test/firebaseEnvironmentMock");
  });

  it("binds Jest authentication to this frame instead of shared persisted browser identity", async () => {
    mockInitializeAuth.mockClear();
    mockGetAuth.mockClear();
    /** Loaded browser Firebase module exercises session persistence configuration. */
    const module = await loadWithEnvironment({...completeEnvironment, platformTarget: "jest"});
    expect(module.auth).toEqual({name: "frame-auth"});
    expect(mockInitializeAuth).toHaveBeenCalledWith(module.firebaseApp, {persistence: mockInMemoryPersistence});
    expect(mockGetAuth).not.toHaveBeenCalled();
  });

  it("retains the existing authentication initialization for other target assemblies", async () => {
    mockInitializeAuth.mockClear();
    mockGetAuth.mockClear();
    /** Loaded browser Firebase module exercises session persistence configuration. */
    const module = await loadWithEnvironment({...completeEnvironment, platformTarget: "facebook"});
    expect(module.auth).toEqual({name: "auth"});
    expect(mockGetAuth).toHaveBeenCalledWith(module.firebaseApp);
    expect(mockInitializeAuth).not.toHaveBeenCalled();
  });

  it("routes all Jest multiplayer calls beside Firestore without rerouting other capabilities", async () => {
    mockGetFunctions.mockClear();
    mockHttpsCallable.mockClear();
    await loadWithEnvironment({...completeEnvironment, platformTarget: "jest"});
    /** Multiplayer calls must share the database region, without moving account/economy calls. */
    const multiplayerCalls = [
      "getRaceAccess",
      "findRaceMatch",
      "recordRaceAnalytics",
      "listRaceCategories",
      "startRaceRun",
      "readyRaceRun",
      "submitRaceGuess",
      "requestRaceHint",
      "skipRaceRiddle",
      "resumeRaceRun",
      "abandonRaceRun",
      "publishRaceChallenge",
      "reserveRaceInvite",
      "getRaceChallenge",
      "getRaceOutcome",
      "listRaceInbox",
      "getRaceEntry",
      "cancelRaceInvite",
      "joinLiveRace",
      "updateLiveRace",
      "getLiveRaceChallenge",
    ];
    for (const [instance, name] of mockHttpsCallable.mock.calls) {
      expect(instance).toMatchObject({region: multiplayerCalls.includes(name) ? "europe-west1" : "europe-west2"});
    }
    expect(mockGetFunctions).toHaveBeenCalledWith(expect.anything(), "europe-west1");
  });

  it("uses provided configuration and region values", async () => {
    mockInitializeApp.mockClear();
    mockGetFunctions.mockClear();
    /** Provides module behavior. */
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
  });
});
