import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {CallableRequest} from "firebase-functions/v2/https";

/** Describes mock document ref. */
type MockDocumentRef = {
  /** Stores kind. */
  kind: "document";
  /** Stores path. */
  path: string;
};
/** Describes mock query ref. */
type MockQueryRef = {
  /** Stores kind. */
  kind: "query";
  /** Stores collection. */
  collection: string;
  /** Stores field. */
  field: string;
  /** Stores value. */
  value: unknown;
};
/** Provides mock firestore documents behavior. */
const mockFirestoreDocuments = new Map<string, Record<string, unknown>>();
/** Provides mock transaction get behavior. */
const mockTransactionGet = jest.fn(async (ref: MockDocumentRef | MockQueryRef) => {
  if (ref.kind === "query") {
    /** Provides prefix behavior. */
    const prefix = `${ref.collection}/`;
    /** Provides docs behavior. */
    const docs = [...mockFirestoreDocuments.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && data[ref.field] === ref.value)
      .map(([path, data]) => ({id: path.slice(prefix.length), data: () => data}));
    return {empty: docs.length === 0, docs};
  }
  /** Provides data behavior. */
  const data = mockFirestoreDocuments.get(ref.path);
  return {exists: data !== undefined, data: () => data, get: (field: string) => data?.[field]};
});
/** Provides mock transaction create behavior. */
const mockTransactionCreate = jest.fn((ref: MockDocumentRef, data: Record<string, unknown>) => {
  if (mockFirestoreDocuments.has(ref.path)) throw new Error(`already exists: ${ref.path}`);
  mockFirestoreDocuments.set(ref.path, data);
});
/** Provides mock transaction set behavior. */
const mockTransactionSet = jest.fn((ref: MockDocumentRef, data: Record<string, unknown>) => {
  mockFirestoreDocuments.set(ref.path, {...mockFirestoreDocuments.get(ref.path), ...data});
});
/** Provides mock transaction behavior. */
const mockTransaction = {
  get: mockTransactionGet,
  create: mockTransactionCreate,
  set: mockTransactionSet,
  update: jest.fn(),
  delete: jest.fn(),
};
/** Provides mock admin firestore doc behavior. */
const mockDoc = (collection: string, id = "") => ({kind: "document" as const, collection, id, path: `${collection}/${id}`});
/** Provides mock admin firestore collection behavior. */
const mockCollection = (path: string) => ({
  doc: (id?: string) => mockDoc(path, id),
  where: (field: string, _operator: string, value: unknown) => ({
    limit: () => ({kind: "query" as const, collection: path, field, value}),
  }),
});
/** Registration options seen at module load; a plain array survives the configured mock clearing. */
const mockOnCallRegistrations: unknown[] = [];
/** Provides mock on call behavior. */
const mockOnCall = (optionsOrHandler: unknown, handler?: unknown) => {
  mockOnCallRegistrations.push(optionsOrHandler);
  return typeof optionsOrHandler === "function" ? optionsOrHandler : handler;
};

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()},
}));
jest.mock("../../../../../firebase-functions/src/shared/firebaseAdmin", () => ({
  admin: {
    firestore: () => ({
      collection: (path: string) => mockCollection(path),
      doc: (path: string) => ({kind: "document" as const, path}),
      runTransaction: (callback: (transaction: typeof mockTransaction) => unknown) => callback(mockTransaction),
    }),
  },
}));
jest.mock("../../../../../firebase-functions/src/shared/accountDeletion", () => ({
  ...jest.requireActual<typeof import("../../../../../firebase-functions/src/shared/accountDeletion")>("../../../../../firebase-functions/src/shared/accountDeletion"),
  runWithJestAccountOperationLease: async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) =>
    operation(),
}));
jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual v2 https behavior. */
  const actual = jest.requireActual<typeof import("firebase-functions/v2/https")>("firebase-functions/v2/https");
  return {onCall: (...args: [unknown, unknown?]) => mockOnCall(...args), HttpsError: actual.HttpsError};
});

import {HttpsError} from "firebase-functions/v2/https";
import {createAndroidUser, isAndroidAccountProvider} from "../androidUser";
import {provisionAndroidAccount, type ProvisionAndroidAccountResponse} from "../provisionAndroidAccount";

/** Invokes the callable handler as Firebase would, after the Sentry and protection wrappers. */
const invoke = (auth: CallableRequest["auth"]): Promise<ProvisionAndroidAccountResponse> =>
  (provisionAndroidAccount as unknown as (request: Partial<CallableRequest>) => Promise<ProvisionAndroidAccountResponse>)({
    data: undefined,
    rawRequest: {headers: {}} as never,
    acceptsStreaming: false,
    auth,
  });
/** Builds callable auth for a sign-in provider. */
const authFor = (uid: string, provider: string) =>
  ({uid, token: {firebase: {sign_in_provider: provider, ...(provider === "google.com" ? {identities: {"google.com": [`google-subject-${uid}`]}} : {})}}}) as unknown as CallableRequest["auth"];

describe("createAndroidUser", () => {
  it("starts every Android account with the Jest balance, stats, and progress", () => {
    /** Fresh account payload. */
    const user = createAndroidUser("android-uid", "anonymous");
    expect(user).toMatchObject({
      userId: "android-uid",
      coins: 300,
      hasPurchasedApp: false,
      hasActiveSubscription: false,
      androidProvider: "anonymous",
      progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
      unlockedAchievements: [],
    });
    expect(user.username).toMatch(/^Android [a-f0-9]{16}$/u);
    expect(user.email).toBe("android-uid@players.android.invalid");
  });

  it("derives a stable username from the uid only", () => {
    expect(createAndroidUser("same", "anonymous").username).toBe(createAndroidUser("same", "google.com").username);
    expect(createAndroidUser("one", "anonymous").username).not.toBe(createAndroidUser("two", "anonymous").username);
  });

  it("accepts only anonymous and Google providers", () => {
    expect(isAndroidAccountProvider("anonymous")).toBe(true);
    expect(isAndroidAccountProvider("google.com")).toBe(true);
    expect(isAndroidAccountProvider("custom")).toBe(false);
    expect(isAndroidAccountProvider(undefined)).toBe(false);
  });
});

describe("provisionAndroidAccount", () => {
  beforeEach(() => {
    mockFirestoreDocuments.clear();
    mockTransactionCreate.mockClear();
  });

  it("registers with the shared browser-facing security options", () => {
    expect(mockOnCallRegistrations).toContainEqual(
      expect.objectContaining({enforceAppCheck: expect.any(Boolean), invoker: "public", minInstances: 0}),
    );
  });

  it("rejects unauthenticated callers", async () => {
    await expect(invoke(undefined)).rejects.toMatchObject({code: "unauthenticated"});
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it("rejects providers other than anonymous or Google", async () => {
    await expect(invoke(authFor("jest-player", "custom"))).rejects.toBeInstanceOf(HttpsError);
    await expect(invoke(authFor("jest-player", "custom"))).rejects.toMatchObject({code: "permission-denied"});
    expect(mockFirestoreDocuments.has("users/jest-player")).toBe(false);
  });

  it("creates the account once and reserves its username", async () => {
    /** First provisioning response. */
    const first = await invoke(authFor("android-1", "anonymous"));
    expect(first).toEqual({uid: "android-1", created: true, coins: 300});
    /** Persisted account document. */
    const stored = mockFirestoreDocuments.get("users/android-1");
    expect(stored).toMatchObject({userId: "android-1", coins: 300, androidProvider: "anonymous"});
    expect([...mockFirestoreDocuments.keys()].some((path) => path.startsWith("usernames/") || path.startsWith("usernameReservations/"))).toBe(true);
    /** Repeat provisioning response. */
    const second = await invoke(authFor("android-1", "anonymous"));
    expect(second).toEqual({uid: "android-1", created: false, coins: 300});
    expect(mockTransactionCreate.mock.calls.filter(([ref]) => ref.path === "users/android-1")).toHaveLength(1);
  });

  it("returns the current balance of an existing account", async () => {
    /** Firebase-generated account identity carrying verified Google provider claims. */
    const uid = "g".repeat(28);
    mockFirestoreDocuments.set(`users/${uid}`, {...createAndroidUser(uid, "anonymous"), coins: 1250});
    await expect(invoke(authFor(uid, "google.com"))).resolves.toEqual({uid, created: false, coins: 1250});
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });
});
