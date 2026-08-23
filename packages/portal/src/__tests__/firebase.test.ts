const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_firestore: unknown, collection: string, id: string) => ({collection, id}));
const mockHttpsCallable = jest.fn((_functions: unknown, name: string) => Object.assign(jest.fn(), {callableName: name}));
const mockInitializeApp = jest.fn(() => ({name: "firebase-app"}));
const mockGetAuth = jest.fn(() => ({name: "auth"}));
const mockGetFirestore = jest.fn(() => ({name: "firestore"}));
const mockGetFunctions = jest.fn(() => ({name: "functions"}));

jest.mock("firebase/app", () => ({initializeApp: (...args: unknown[]) => mockInitializeApp(...args)}));
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
  firebaseApp,
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
      "submitSinglePlayerGuess",
      "getHint",
      "spendCoins",
      "skipRiddle",
      "getLeaderboard",
      "updateUsername",
      "updateAvatar",
      "deleteAccount",
      "setPresenceConsent",
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
      "blockRival",
      "reportRival",
      "getRaceAccess",
      "recordRaceAnalytics",
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
  const completeEnvironment = {
    apiKey: "api-key",
    appId: "app-id",
    authDomain: "example.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "project-id",
    measurementId: "G-PROVIDED",
    functionsRegion: "europe-west2",
  } as const;

  const loadWithEnvironment = async (
    environment: typeof completeEnvironment | Record<string, unknown>,
  ) => {
    jest.doMock("../test/firebaseEnvironmentMock", () => ({firebaseEnvironment: environment}));
    let loaded: typeof import("../firebase") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../firebase");
    });
    return loaded!;
  };

  afterEach(() => {
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
  });
});
