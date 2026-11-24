import {protectContent} from "../../../content/transport/contentProtection";
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

import {auth, firebaseApp, loadUserDocument, getCurrentClassicRiddle} from "../browserClient";
import {createFirebaseRaceMatchmaking} from "../../../races/transport/browser/firebaseRaceMatchmaking";

describe("Firebase browser adapter", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it.each(["retired", "superseded"])("delivers the original join identity through the lazy regional retirement adapter: %s", async status => {
    /** SDK callable captures the command before any authenticated provider response. */
    const index = mockHttpsCallable.mock.calls.findIndex(call => call[1] === "retireLiveRaceJoin");
    /** Original account is a precondition carried intact through lazy module loading. */
    const input = {requestId: "original-owned-join", expectedOwnerId: "jest_original_account"};
    /** Native SDK envelope remains the only mocked boundary. */
    const sdk = mockHttpsCallable.mock.results[index].value;
    sdk.mockResolvedValueOnce({data: {status}});
    await expect(createFirebaseRaceMatchmaking().live!.retireJoin!(input)).resolves.toEqual({status});
    expect(sdk).toHaveBeenLastCalledWith(input);
  });

  it("negotiates encrypted answer delivery and restores the SDK result before domain validation", async () => {
    /** Underlying SDK operation captured before the transport adapter wraps it. */
    const index = mockHttpsCallable.mock.calls.findIndex(call => call[1] === "getCurrentClassicRiddle");
    /** Server response retained independently of its transport representation. */
    const data = {challenge: {questions: [{evaluation: {answer: "café", locale: "fr"}}]}};
    /** Native SDK callable returns its standard data envelope. */
    const sdk = mockHttpsCallable.mock.results[index].value;
    sdk.mockResolvedValueOnce({data: await protectContent(data)});
    await expect(getCurrentClassicRiddle({classicIndex: 1, locale: "fr"})).resolves.toEqual({data});
    expect(sdk).toHaveBeenCalledWith({classicIndex: 1, locale: "fr", contentProtection: 1});
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
      "retireLiveRaceJoin",
      "confirmLiveGuessReceipt",
      "updateLiveRace",
      "getLiveRaceChallenge",
      "sendLiveRaceChallenge",
      "listLiveRaceChallenges",
      "listLiveRaceHistory",
      "setNotificationPreference",
      "setLiveRacePushSubscription",
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
    jest.doMock("../../../app/testing/mocks/firebaseEnvironmentMock", () => ({firebaseEnvironment: environment}));
    /** Loads ed. */
    let loaded: typeof import("../browserClient") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../browserClient");
    });
    return loaded!;
  };

  afterEach(() => {
    jest.dontMock("../../../app/testing/mocks/firebaseEnvironmentMock");
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

  it.each(["jest", "facebook"])("routes %s gameplay beside Firestore without rerouting account or commerce calls", async platformTarget => {
    mockGetFunctions.mockClear();
    mockHttpsCallable.mockClear();
    await loadWithEnvironment({...completeEnvironment, platformTarget});
    /** Session operations share the database region while accounts and purchases retain their configured endpoint. */
    const multiplayerCalls = [
      "getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer",
      "completeGame", "submitSinglePlayerGuess", "getHint", "spendCoins", "skipRiddle",
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
      "retireLiveRaceJoin",
      "confirmLiveGuessReceipt",
      "updateLiveRace",
      "getLiveRaceChallenge",
      "sendLiveRaceChallenge",
      "listLiveRaceChallenges",
      "listLiveRaceHistory",
      "setNotificationPreference",
      "setLiveRacePushSubscription",
    ];
    for (const [instance, name] of mockHttpsCallable.mock.calls) {
      expect(instance).toMatchObject({region: multiplayerCalls.includes(name) ? "europe-west1" : "europe-west2"});
    }
    expect(mockGetFunctions).toHaveBeenCalledWith(expect.anything(), "europe-west1");
  });

  it.each(["jest", "facebook"])("can roll %s solo back to the existing US endpoints without moving multiplayer", async platformTarget => {
    mockHttpsCallable.mockClear();
    await loadWithEnvironment({...completeEnvironment, platformTarget, gameplayRegion: "us-central1"});
    /** A rollback must cover every session action together. */
    const soloCalls = ["getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer",
      "completeGame", "submitSinglePlayerGuess", "getHint", "spendCoins", "skipRiddle"];
    for (const [instance, name] of mockHttpsCallable.mock.calls) {
      if (soloCalls.includes(name)) expect(instance).toMatchObject({region: "us-central1"});
      if (name === "joinLiveRace" || name === "updateLiveRace" || name === "retireLiveRaceJoin") expect(instance).toMatchObject({region: "europe-west1"});
      if (name === "deleteAccount") expect(instance).toMatchObject({region: "europe-west2"});
    }
  });

  it.each(["jest", "facebook"])("applies the optional solo region to gameplay only (%s)", async platformTarget => {
    mockHttpsCallable.mockClear();
    await loadWithEnvironment({...completeEnvironment, platformTarget, gameplayRegion: "europe-west1"});
    /** Every session action must use one selected region; other capabilities keep their own endpoints. */
    const soloCalls = ["getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer",
      "completeGame", "submitSinglePlayerGuess", "getHint", "spendCoins", "skipRiddle"];
    /** Economy and account calls must not move as a side effect of gameplay regional routing. */
    const unchangedCalls = ["createYahooStripeCheckout", "confirmYahooStripeCheckout", "updateUsername", "deleteAccount"];
    for (const [instance, name] of mockHttpsCallable.mock.calls) {
      if (soloCalls.includes(name)) expect(instance).toMatchObject({region: "europe-west1"});
      if (unchangedCalls.includes(name)) expect(instance).toMatchObject({region: "europe-west2"});
    }
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
