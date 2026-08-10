/** Captured callable handler returned by the Firebase Functions test mock. */
const mockOnCall = jest.fn((_options: unknown, handler: unknown) => handler);
/** Firestore recursive deletion mock. */
const mockRecursiveDelete = jest.fn();
/** Leaderboard document deletion mock. */
const mockLeaderboardDelete = jest.fn();
/** Batched document deletion mock. */
const mockBatchDelete = jest.fn();
/** Batched commit mock. */
const mockBatchCommit = jest.fn();
/** Storage prefix deletion mock. */
const mockDeleteFiles = jest.fn();
/** Firebase Authentication deletion mock. */
const mockDeleteUser = jest.fn();
/** Number of query pages requested for each owned collection. */
const queryPages = new Map<string, number>();

jest.mock("firebase-functions/v2/https", () => {
  const actual = jest.requireActual("firebase-functions/v2/https");
  return {...actual, onCall: (...args: unknown[]) => mockOnCall(...args)};
});
jest.mock("firebase-functions/v2", () => ({logger: {error: jest.fn()}}));
jest.mock("../shared/callableSecurity", () => ({browserCallableSecurityOptions: {enforceAppCheck: true}}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn()}));
jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    firestore: () => ({
      collection: (collection: string) => ({
        doc: () => collection === "leaderboard" ? {delete: mockLeaderboardDelete} : {path: `users/user-1`},
        where: () => ({
          limit: () => ({
            get: async () => {
              const page = queryPages.get(collection) ?? 0;
              queryPages.set(collection, page + 1);
              return page === 0 && collection === "raceRuns"
                ? {empty: false, docs: [{ref: {path: "raceRuns/run-1"}}]}
                : {empty: true, docs: []};
            },
          }),
        }),
      }),
      batch: () => ({delete: mockBatchDelete, commit: mockBatchCommit}),
      recursiveDelete: mockRecursiveDelete,
    }),
    storage: () => ({bucket: () => ({deleteFiles: mockDeleteFiles})}),
    auth: () => ({deleteUser: mockDeleteUser}),
  },
}));

import {deleteAccount} from "../profile/accountDeletion";

describe("deleteAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryPages.clear();
    mockBatchCommit.mockResolvedValue(undefined);
    mockRecursiveDelete.mockResolvedValue(undefined);
    mockLeaderboardDelete.mockResolvedValue(undefined);
    mockDeleteFiles.mockResolvedValue([]);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated deletion requests", async () => {
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({data: {}}))
      .rejects.toMatchObject({code: "unauthenticated"});
  });

  it("deletes only resources owned by the authenticated player", async () => {
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
      auth: {uid: "user-1", token: {}},
      data: {userId: "attacker-selected-user"},
    })).resolves.toEqual({success: true});

    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceRuns/run-1"});
    expect(mockRecursiveDelete).toHaveBeenCalledWith({path: "users/user-1"});
    expect(mockLeaderboardDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "avatars/user-1/"});
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "exports/user-1/"});
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
    expect(mockDeleteUser).not.toHaveBeenCalledWith("attacker-selected-user");
  });

  it("is idempotent when the Firebase Auth identity is already absent", async () => {
    mockDeleteUser.mockRejectedValue({code: "auth/user-not-found"});
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
      auth: {uid: "user-1", token: {}},
      data: {},
    })).resolves.toEqual({success: true});
  });

  it("continues when the project has no Firebase Storage bucket", async () => {
    mockDeleteFiles.mockRejectedValue({code: 404});
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
      auth: {uid: "user-1", token: {}},
      data: {},
    })).resolves.toEqual({success: true});
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("maps unexpected deletion failures to an internal callable error", async () => {
    mockRecursiveDelete.mockRejectedValue(new Error("Firestore unavailable"));
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
      auth: {uid: "user-1", token: {}},
      data: {},
    })).rejects.toEqual(expect.objectContaining({code: "internal"}));
  });
});
