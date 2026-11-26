/** Captured callable handler returned by the Firebase Functions test mock. */
const mockOnCall = jest.fn((_options: unknown, handler: unknown) => handler);
/** Privacy-safe Cloud Logging mock. */
const mockLoggerError = jest.fn();
/** Firestore recursive deletion mock. */
const mockRecursiveDelete = jest.fn();
/** Deterministic current referral-verification document deletion mock. */
const mockReferralVerificationDelete = jest.fn();
/** Direct deletion mock for legacy document-ID-owned records. */
const mockDirectDocumentDelete = jest.fn();
const mockNotificationPairingLimitDelete = jest.fn();
/** Native raw subscription receipts must disappear with their owning account. */
const mockAndroidCommerceDelete = jest.fn();
/** Direct deletion mock for the provider-neutral Reddit player snapshot. */
const mockRedditPlayerStorageDelete = jest.fn();
/** Permanent pseudonymous Jest account-deletion guard write mock. */
const mockJestDeletionSet = jest.fn();
/** Active-operation drain query run after the permanent guard is written. */
const mockActiveOperationsGet = jest.fn(async () => ({empty: true, docs: []}));
/** Transactional username/profile document deletion mock. */
const mockTransactionDelete = jest.fn();
/** Owner returned by a normalized username reservation lookup. */
let mockReservationOwner = "user-1";
/** Transactional document lookup mock. */
const mockTransactionGet = jest.fn(
  async (ref: {
    /** Stores path. */ /** Stores path. */ /** Stores path. */
    /** Stores path. */
    path: string;
  }) => {
    if (ref.path.startsWith("jestAccountDeletionTombstones/")) return {exists: mockJestDeletionSet.mock.calls.length > 0, data: () => ({recreationBlocked: true})};
    if (ref.path === "users/user-1") {
      return {exists: true, data: () => ({username: "Player One"})};
    }
    if (ref.path.startsWith("usernameReservations/")) {
      return {exists: true, data: () => ({userId: mockReservationOwner})};
    }
    return {exists: false, data: () => undefined};
  },
);
/** Firestore transaction runner mock. */
const mockRunTransaction = jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) =>
  callback({
    get: mockTransactionGet,
    delete: mockTransactionDelete,
  }),
);
/** Batched document deletion mock. */
const mockBatchDelete = jest.fn();
/** Batched document replacement mock. */
const mockBatchSet = jest.fn();
/** Batched document update mock. */
const mockBatchUpdate = jest.fn();
/** Batched commit mock. */
const mockBatchCommit = jest.fn();
/** Storage prefix deletion mock. */
const mockDeleteFiles = jest.fn();
/** Firebase Authentication deletion mock. */
const mockDeleteUser = jest.fn();
/** Disabled Auth sentinel retained for a deleted deterministic Jest UID. */
const mockPreserveDeletedJestAuthUser = jest.fn();
/** Provider-aware Facebook generation deletion mock. */
const mockDeleteFacebookAccountGeneration = jest.fn();
/** Number of query pages requested for each owned collection. */
const queryPages = new Map<string, number>();
/** First-page documents returned for a specific collection query. */
const queryDocuments = new Map<
  string,
  Array<{
    /** Stores id. */
    id: string;
    /** Stores ref. */
    ref: {
      /** Stores path. */
      path: string;
    };
    /** Provides data behavior. */
    data(): Record<string, unknown>;
  }>
>();
/** Nested idempotency receipts returned beneath a race run. */
const nestedRequestDocuments = new Map<string, ReturnType<typeof queryDocument>[]>();

/** Creates one mocked Firestore query document. */
function queryDocument(path: string, data: Record<string, unknown>) {
  /** Provides ref behavior. */
  const ref = {path} as {
    /** Stores path. */
    path: string; /** Provides collection behavior. */
    /** Provides collection behavior. */
    collection(name: string): ReturnType<typeof mockCreateNestedQuery>;
  };
  Object.defineProperty(ref, "collection", {
    value: (name: string) => mockCreateNestedQuery(`${path}/${name}`),
    enumerable: false,
  });
  return {
    id: path.slice(path.lastIndexOf("/") + 1),
    ref,
    data: () => data,
  };
}

/** Creates a document-ID-paginated nested request-receipt query. */
const mockCreateNestedQuery = (scope: string) => {
  /** Provides key behavior. */
  const key = `nested:${scope}`;
  /** Provides query behavior. */
  const query = {
    orderBy: jest.fn(),
    startAfter: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(async () => {
      /** Provides page behavior. */
      const page = queryPages.get(key) ?? 0;
      queryPages.set(key, page + 1);
      /** Provides docs behavior. */
      const docs = page === 0 ? (nestedRequestDocuments.get(scope) ?? []) : [];
      return {empty: docs.length === 0, docs};
    }),
  };
  query.orderBy.mockReturnValue(query);
  query.startAfter.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
};

/** Creates one chainable bounded Firestore query mock. */
const mockCreateQuery = (scope: string, field: string, value: string) => {
  /** Provides key behavior. */
  const key = `${scope}:${field}:${value}`;
  /** Provides query behavior. */
  const query = {
    orderBy: jest.fn(),
    startAfter: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(async () => {
      /** Provides page behavior. */
      const page = queryPages.get(key) ?? 0;
      queryPages.set(key, page + 1);
      /** Provides docs behavior. */
      const docs = page === 0 ? (queryDocuments.get(key) ?? []) : [];
      return {empty: docs.length === 0, docs};
    }),
  };
  query.orderBy.mockReturnValue(query);
  query.startAfter.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
};

jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual behavior. */
  const actual = jest.requireActual("firebase-functions/v2/https");
  return {...actual, onCall: (...args: unknown[]) => mockOnCall(...args)};
});
jest.mock("firebase-functions/v2", () => ({logger: {error: mockLoggerError}}));
jest.mock("../shared/callableSecurity", () => ({browserCallableSecurityOptions: {enforceAppCheck: true}}));
jest.mock("../../../platforms/web/jest/server/jestDeletedAuthUser", () => ({preserveDeletedJestAuthUser: mockPreserveDeletedJestAuthUser}));
jest.mock("../../../platforms/web/facebook/server/facebookAccountDeletion", () => ({
  deleteFacebookAccountGeneration: mockDeleteFacebookAccountGeneration,
}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn().mockResolvedValue(true)}));
jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    firestore: Object.assign(
      () => ({
        doc: (path: string) => ({path, delete: () => mockNotificationPairingLimitDelete(path)}),
        collection: (collection: string) => ({
          orderBy: () => mockCreateQuery(collection, "__name__", "*"),
          doc: (id = "user-1") =>
            collection === "jestReferralVerifications"
              ? {delete: mockReferralVerificationDelete, path: `${collection}/${id}`}
              : collection === "redditPlayerStorage"
                ? {delete: mockRedditPlayerStorageDelete, path: `${collection}/${id}`}
                : collection === "androidCommerceAccounts"
                  ? {delete: () => mockAndroidCommerceDelete(id), path: `${collection}/${id}`}
                : collection === "tutorialProgress" ||
                    collection === "facebookCommerceAccounts" ||
                    collection === "redditCommerceAccounts" ||
                    collection === "facebookNotificationPromptLeases" ||
                    collection === "facebookReferralBindings" ||
                    collection === "redditReferralBindings"
                  ? {delete: mockDirectDocumentDelete, path: `${collection}/${id}`}
                  : collection === "jestAccountDeletionTombstones"
                    ? {
                        set: mockJestDeletionSet,
                        path: `${collection}/${id}`,
                        collection: () => ({
                          limit: () => ({get: mockActiveOperationsGet}),
                        }),
                      }
                    : {path: `${collection}/${id}`},
          where: (field: string, _operator: string, value: string) => mockCreateQuery(collection, field, value),
        }),
        collectionGroup: (collection: string) => ({
          where: (field: string, _operator: string, value: string) => mockCreateQuery(collection, field, value),
        }),
        batch: () => ({
          delete: mockBatchDelete,
          set: mockBatchSet,
          update: mockBatchUpdate,
          commit: mockBatchCommit,
        }),
        runTransaction: mockRunTransaction,
        recursiveDelete: mockRecursiveDelete,
      }),
      {
        FieldPath: {documentId: () => "__name__"},
        FieldValue: {delete: () => "field-delete", serverTimestamp: () => "server-timestamp"},
      },
    ),
    storage: () => ({bucket: () => ({deleteFiles: mockDeleteFiles})}),
    database: () => ({
      ref: (path?: string) => (path ? {get: async () => ({val: () => null})} : {update: async () => undefined}),
    }),
    auth: () => ({deleteUser: mockDeleteUser}),
  },
}));

import {deleteAccount} from "../profile/accountDeletion/index";
import {deleteAccountForUser} from "../profile/accountDeletion/deleteAccountData";
import {createJestPurchaseGrantId} from "../../../platforms/web/jest/server/jestPurchaseReceipts";
import {createUsernameReservationId} from "../profile/usernameReservations";
import {hashRaceCohortUser} from "../race/access/raceRollout";
import {requestDocumentId} from "../race/raceSetupService";
import {jestFirebaseUid} from "../../../platforms/web/jest/server/jestSecurity";

describe("deleteAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryPages.clear();
    queryDocuments.clear();
    nestedRequestDocuments.clear();
    queryDocuments.set("raceRuns:userId:user-1", [
      queryDocument("raceRuns/run-1", {
        userId: "user-1",
        challengeId: "challenge-entered",
      }),
    ]);
    queryDocuments.set("raceAttempts:playerId:user-1", [
      queryDocument("raceAttempts/attempt-1", {
        playerId: "user-1",
        challengeId: "challenge-attempt-only",
      }),
    ]);
    queryDocuments.set("raceChallenges:creatorId:user-1", [
      queryDocument("raceChallenges/challenge-owned", {
        creatorId: "user-1",
        challengeId: "challenge-owned",
      }),
    ]);
    queryDocuments.set("raceRuns:opponent.subjectUserId:user-1", [
      queryDocument("raceRuns/foreign-subject-linked", {
        userId: "other-user",
        opponent: {subjectUserId: "user-1", displayName: "Player One", avatarUrl: "https://example.test/a"},
      }),
    ]);
    queryDocuments.set("raceRuns:challengeId:challenge-owned", [
      queryDocument("raceRuns/foreign-legacy", {
        userId: "other-user",
        challengeId: "challenge-owned",
        opponent: {displayName: "Player One", avatarUrl: "https://example.test/legacy"},
      }),
    ]);
    nestedRequestDocuments.set("raceRuns/foreign-subject-linked/requests", [
      queryDocument("raceRuns/foreign-subject-linked/requests/receipt-1", {
        response: {run: {opponent: {displayName: "Player One", avatarUrl: "https://example.test/a"}}},
      }),
    ]);
    nestedRequestDocuments.set("raceRuns/foreign-legacy/requests", [
      queryDocument("raceRuns/foreign-legacy/requests/receipt-2", {
        response: {run: {opponent: {displayName: "Player One", avatarUrl: "https://example.test/legacy"}}},
      }),
    ]);
    nestedRequestDocuments.set("raceRuns/run-1/requests", [
      queryDocument("raceRuns/run-1/requests/owned-receipt", {
        response: {run: {opponent: {displayName: "Other Player", avatarUrl: "https://example.test/opponent"}}},
      }),
    ]);
    queryDocuments.set("raceInbox:opponentUserId:user-1", [
      queryDocument("users/other-user/raceInbox/new-item", {
        opponentUserId: "user-1",
        opponentDisplayName: "Player One",
      }),
    ]);
    queryDocuments.set("raceInviteLobbies:creatorId:user-1", [
      queryDocument("raceInviteLobbies/created-invite", {creatorId: "user-1"}),
    ]);
    queryDocuments.set("raceInviteLobbies:recipientId:user-1", [
      queryDocument("raceInviteLobbies/claimed-invite", {recipientId: "user-1"}),
    ]);
    queryDocuments.set("raceInviteRequests:userId:user-1", [
      queryDocument("raceInviteRequests/reservation-receipt", {userId: "user-1"}),
    ]);
    queryDocuments.set(`raceInbox:itemId:${requestDocumentId("challenge-entered", "user-1")}`, [
      queryDocument("users/creator-1/raceInbox/legacy-run-item", {
        itemId: requestDocumentId("challenge-entered", "user-1"),
        opponentDisplayName: "Player One",
      }),
    ]);
    queryDocuments.set(`raceInbox:itemId:${requestDocumentId("challenge-attempt-only", "user-1")}`, [
      queryDocument("users/creator-2/raceInbox/legacy-attempt-item", {
        itemId: requestDocumentId("challenge-attempt-only", "user-1"),
        opponentDisplayName: "Player One",
      }),
    ]);
    queryDocuments.set("userClassicProgress:userId:user-1", [
      queryDocument("userClassicProgress/classic-1", {userId: "user-1"}),
    ]);
    queryDocuments.set("leaderboard:subjectUserId:user-1", [
      queryDocument("leaderboard/noncanonical-subject-copy", {
        userId: "user-1",
        subjectUserId: "user-1",
        username: "Player One",
      }),
    ]);
    queryDocuments.set("requests:userId:user-1", [
      queryDocument("raceRuns/deleted-parent/requests/orphaned-owned-receipt", {
        userId: "user-1",
        response: {run: {opponent: {displayName: "Other Player"}}},
      }),
    ]);
    queryDocuments.set("userDailyChallengeAttempts:userId:user-1", [
      queryDocument("userDailyChallengeAttempts/daily-1", {userId: "user-1"}),
    ]);
    queryDocuments.set(`raceAnalytics:cohortUserHash:${hashRaceCohortUser("user-1")}`, [
      queryDocument("raceAnalytics/event-1", {cohortUserHash: hashRaceCohortUser("user-1")}),
    ]);
    queryDocuments.set("socialModerationQueue:reporterId:user-1", [
      queryDocument("socialModerationQueue/reported-by-user", {
        reporterId: "user-1",
        targetUserId: "other-user",
        status: "queued",
      }),
    ]);
    queryDocuments.set("socialModerationQueue:targetUserId:user-1", [
      queryDocument("socialModerationQueue/report-targeting-user", {
        reporterId: "other-user",
        targetUserId: "user-1",
        status: "queued",
      }),
    ]);
    queryDocuments.set("socialReportRateLimits:reporterId:user-1", [
      queryDocument("socialReportRateLimits/user-day", {reporterId: "user-1", count: 1}),
    ]);
    queryDocuments.set("redditCommerceReceipts:uid:user-1", [
      queryDocument("redditCommerceReceipts/order-hash", {
        provider: "reddit",
        uid: "user-1",
        orderIdHash: "order-hash",
        environment: "sandbox",
        productId: "riddle_quest_coins_250",
        purchasedAtMs: 123,
        grossCoins: 250,
      }),
    ]);
    queryDocuments.set("redditCommerceRefunds:uid:user-1", [
      queryDocument("redditCommerceRefunds/order-hash", {
        provider: "reddit",
        uid: "user-1",
        orderIdHash: "order-hash",
        environment: "sandbox",
        productId: "riddle_quest_coins_250",
        refundedAtMs: 456,
        coinsRemoved: 200,
      }),
    ]);
    mockBatchCommit.mockResolvedValue(undefined);
    mockRecursiveDelete.mockResolvedValue(undefined);
    mockReferralVerificationDelete.mockResolvedValue(undefined);
    mockRedditPlayerStorageDelete.mockResolvedValue(undefined);
    mockJestDeletionSet.mockResolvedValue(undefined);
    mockDeleteFiles.mockResolvedValue([]);
    mockDeleteUser.mockResolvedValue(undefined);
    mockPreserveDeletedJestAuthUser.mockResolvedValue(undefined);
    mockDeleteFacebookAccountGeneration.mockResolvedValue(2);
    mockReservationOwner = "user-1";
  });

  it("rejects unauthenticated deletion requests", async () => {
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({data: {}}),
    ).rejects.toMatchObject({code: "unauthenticated"});
  });

  it("handles a non-Jest authenticated test request without a token object", async () => {
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1"},
        data: {},
      }),
    ).resolves.toEqual({success: true});

    expect(mockJestDeletionSet).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        recreationBlocked: true,
        deletedAt: "server-timestamp",
      },
      {merge: true},
    );
    expect(mockActiveOperationsGet).toHaveBeenCalledTimes(1);
    expect(mockPreserveDeletedJestAuthUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("routes a claimed Facebook identity through generation-aware deletion", async () => {
    /** Provides uid behavior. */
    const uid = `facebook_${"a".repeat(40)}`;
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid, token: {provider: "facebook", accountGeneration: 3}},
        data: {},
      }),
    ).resolves.toEqual({success: true});
    expect(mockDeleteFacebookAccountGeneration).toHaveBeenCalledWith(
      {uid, accountGeneration: 3},
      {uidSecret: expect.any(String)},
    );
    expect(mockJestDeletionSet).not.toHaveBeenCalled();
  });

  it("rejects Facebook-shaped UIDs without matching provider-generation claims", async () => {
    /** Provides uid behavior. */
    const uid = `facebook_${"b".repeat(40)}`;
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid, token: {}},
        data: {},
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {provider: "facebook", accountGeneration: 1}},
        data: {},
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});
  });

  it("deletes only resources owned by the authenticated player", async () => {
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {userId: "attacker-selected-user"},
      }),
    ).resolves.toEqual({success: true});

    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceRuns/run-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceDeadlineFailures/run-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceAttempts/attempt-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceChallenges/challenge-owned"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "users/other-user/raceInbox/new-item"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceInviteLobbies/created-invite"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceInviteLobbies/claimed-invite"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceInviteRequests/reservation-receipt"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "users/creator-1/raceInbox/legacy-run-item"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "users/creator-2/raceInbox/legacy-attempt-item"});
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      {path: "raceRuns/foreign-subject-linked"},
      {
        "opponent.displayName": "Riddle Quest player",
        "opponent.avatarUrl": "field-delete",
      },
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      {path: "raceRuns/foreign-subject-linked"},
      {"opponent.subjectUserId": "field-delete"},
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      {path: "raceRuns/foreign-legacy"},
      {
        "opponent.displayName": "Riddle Quest player",
        "opponent.avatarUrl": "field-delete",
      },
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      {path: "raceRuns/foreign-legacy"},
      {"opponent.subjectUserId": "field-delete"},
    );
    for (const receipt of ["receipt-1", "receipt-2"]) {
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({path: expect.stringContaining(`/requests/${receipt}`)}),
        {
          "response.run.opponent.displayName": "Riddle Quest player",
          "response.run.opponent.avatarUrl": "field-delete",
        },
      );
    }
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceRuns/run-1/requests/owned-receipt"});
    expect(mockBatchDelete).toHaveBeenCalledWith({
      path: "raceRuns/deleted-parent/requests/orphaned-owned-receipt",
    });

    /** Provides linked parent identity call behavior. */
    const linkedParentIdentityCall = mockBatchUpdate.mock.calls.findIndex(
      ([ref, fields]) => ref.path === "raceRuns/foreign-subject-linked" && "opponent.displayName" in fields,
    );
    /** Provides linked receipt call behavior. */
    const linkedReceiptCall = mockBatchUpdate.mock.calls.findIndex(
      ([ref]) => ref.path === "raceRuns/foreign-subject-linked/requests/receipt-1",
    );
    /** Provides linked subject removal call behavior. */
    const linkedSubjectRemovalCall = mockBatchUpdate.mock.calls.findIndex(
      ([ref, fields]) => ref.path === "raceRuns/foreign-subject-linked" && "opponent.subjectUserId" in fields,
    );
    expect(linkedParentIdentityCall).toBeGreaterThanOrEqual(0);
    expect(linkedReceiptCall).toBeGreaterThan(linkedParentIdentityCall);
    expect(linkedSubjectRemovalCall).toBeGreaterThan(linkedReceiptCall);
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "userClassicProgress/classic-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "userDailyChallengeAttempts/daily-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "raceAnalytics/event-1"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "socialModerationQueue/reported-by-user"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "socialModerationQueue/report-targeting-user"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "socialReportRateLimits/user-day"});
    expect(mockDirectDocumentDelete).toHaveBeenCalledWith();
    expect(mockRedditPlayerStorageDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledWith(
      {path: "redditCommerceReceipts/order-hash"},
      {
        provider: "reddit",
        replayProtection: true,
        orderIdHash: "order-hash",
        environment: "sandbox",
        productId: "riddle_quest_coins_250",
        purchasedAtMs: 123,
      },
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      {path: "redditCommerceRefunds/order-hash"},
      {
        provider: "reddit",
        replayProtection: true,
        orderIdHash: "order-hash",
        environment: "sandbox",
        productId: "riddle_quest_coins_250",
        refundedAtMs: 456,
      },
    );
    expect(mockRecursiveDelete).toHaveBeenCalledWith({path: "users/user-1"});
    expect(mockNotificationPairingLimitDelete).toHaveBeenCalledWith("notificationPairingLimits/user-1");
    expect(mockTransactionDelete).toHaveBeenCalledWith({path: "users/user-1"});
    expect(mockTransactionDelete).toHaveBeenCalledWith({path: "leaderboard/user-1"});
    expect(mockTransactionDelete).toHaveBeenCalledWith({
      path: `usernameReservations/${createUsernameReservationId("Player One")}`,
    });
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "avatars/user-1/"});
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "exports/user-1/"});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "leaderboard/noncanonical-subject-copy"});
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
    expect(mockPreserveDeletedJestAuthUser).not.toHaveBeenCalled();
    expect(mockJestDeletionSet).toHaveBeenCalledTimes(1);
    expect(mockActiveOperationsGet).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).not.toHaveBeenCalledWith("attacker-selected-user");
  });

  it.each(["facebook", "reddit"] as const)("preserves only validated %s completion attribution while removing both referral identities", async provider => {
    /** Opaque solo receipt retained so the surviving invitee can replay its original reward. */
    const completionReceiptId = "a".repeat(64);
    queryDocuments.set(`${provider}ReferralSettlements:inviterUid:user-1`, [
      queryDocument(`${provider}ReferralSettlements/attributed`, {
        provider, inviterUid: "user-1", inviteeUid: "other-user", inviteeCoins: 100, inviterCoins: 100,
        settledAtMs: 123, completionReceiptId,
      }),
      queryDocument(`${provider}ReferralSettlements/malformed`, {
        provider, inviterUid: "user-1", inviteeUid: "other-user", inviteeCoins: 100, inviterCoins: 100,
        settledAtMs: 123, completionReceiptId: "player@example.com",
      }),
      queryDocument(`${provider}ReferralSettlements/legacy`, {
        provider, inviterUid: "user-1", inviteeUid: "other-user", inviteeCoins: 100, inviterCoins: 100,
        settledAtMs: 123,
      }),
    ]);

    await deleteAccountForUser("user-1");

    expect(mockBatchSet).toHaveBeenCalledWith({path: `${provider}ReferralSettlements/attributed`}, {
      provider, replayProtection: true, inviteeCoins: 100, inviterCoins: 100, settledAtMs: 123, completionReceiptId,
    });
    for (const receipt of ["malformed", "legacy"]) {
      expect(mockBatchSet).toHaveBeenCalledWith({path: `${provider}ReferralSettlements/${receipt}`}, {
        provider, replayProtection: true, inviteeCoins: 100, inviterCoins: 100, settledAtMs: 123,
      });
    }
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("removes Android purchase identity and order ids while preserving replay protection", async () => {
    queryDocuments.set("androidPurchaseGrants:uid:user-1", [queryDocument("androidPurchaseGrants/token-hash", {
      uid: "user-1", productId: "coinpack1", coins: 250, orderId: "GPA-private-order", grantedAt: "timestamp",
    })]);
    await expect((deleteAccount as unknown as (request: unknown) => Promise<unknown>)({auth: {uid: "user-1", token: {}}, data: {}}))
      .resolves.toEqual({success: true});
    expect(mockBatchSet).toHaveBeenCalledWith({path: "androidPurchaseGrants/token-hash"}, {
      provider: "android", replayProtection: true, productId: "coinpack1", coins: 250, grantedAt: "timestamp",
    });
    expect(mockAndroidCommerceDelete).toHaveBeenCalledWith("user-1");
  });

  it("removes Jest referral identity while preserving anonymized anti-replay receipts", async () => {
    /** Provides r id. */
    const userId = jestFirebaseUid("jest-player-1");
    /** Provides legacy purchase token behavior. */
    const legacyPurchaseToken = "legacy-purchase-token";
    /** Provides purchase token hash behavior. */
    const purchaseTokenHash = createJestPurchaseGrantId(legacyPurchaseToken);
    queryDocuments.set(`jestPurchaseGrants:uid:${userId}`, [
      queryDocument(`jestPurchaseGrants/${legacyPurchaseToken}`, {
        uid: userId,
        playerId: "jest-player-1",
        productSku: "coin-pack",
        coins: 250,
        newCoins: 550,
        grantedAt: "timestamp",
      }),
    ]);
    queryDocuments.set("jestReferralVerifications:playerId:jest-player-1", [
      queryDocument("jestReferralVerifications/verification-1", {playerId: "jest-player-1"}),
    ]);
    queryDocuments.set("jestReferralRewards:playerId:jest-player-1", [
      queryDocument("jestReferralRewards/reward-as-inviter", {
        playerId: "jest-player-1",
        referredPlayerId: "friend-1",
        reference: "riddle_quest_friend_challenge_v2",
        inviterCoins: 100,
        referredCoins: 100,
        joinedAt: "personal-timestamp",
        grantedAt: "timestamp",
      }),
    ]);
    queryDocuments.set("jestReferralRewards:referredPlayerId:jest-player-1", [
      queryDocument("jestReferralRewards/reward-as-friend", {
        playerId: "inviter-1",
        referredPlayerId: "jest-player-1",
        reference: "riddle_quest_race_to_10_v1",
        inviterCoins: 100,
        referredCoins: 100,
        grantedAt: "timestamp",
      }),
    ]);

    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: userId, token: {jestPlayerId: "jest-player-1"}},
        data: {},
      }),
    ).resolves.toEqual({success: true});

    expect(mockBatchDelete).toHaveBeenCalledWith({path: `jestPurchaseGrants/${legacyPurchaseToken}`});
    expect(mockBatchDelete).toHaveBeenCalledWith({path: "jestReferralVerifications/verification-1"});
    expect(mockReferralVerificationDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledWith(
      {path: `jestPurchaseGrants/${purchaseTokenHash}`},
      {
        purchaseTokenHash,
        replayProtection: true,
        productSku: "coin-pack",
        coins: 250,
        grantedAt: "timestamp",
      },
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      {path: "jestReferralRewards/reward-as-inviter"},
      {
        replayProtection: true,
        reference: "riddle_quest_friend_challenge_v2",
        inviterCoins: 100,
        referredCoins: 100,
        grantedAt: "timestamp",
      },
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      {path: "jestReferralRewards/reward-as-friend"},
      expect.not.objectContaining({playerId: expect.anything(), referredPlayerId: expect.anything()}),
    );
    expect(mockDeleteUser).not.toHaveBeenCalledWith(userId);
    expect(mockPreserveDeletedJestAuthUser).toHaveBeenCalledWith(userId);
    expect(mockJestDeletionSet).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        recreationBlocked: true,
        deletedAt: expect.anything(),
      },
      {merge: true},
    );
  });

  it("ignores an untrusted Jest player ID supplied in callable data", async () => {
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {jestPlayerId: "attacker-selected-player"},
      }),
    ).resolves.toEqual({success: true});

    expect([...queryPages.keys()].some((key) => key.includes("attacker-selected-player"))).toBe(false);
  });

  it("rejects a deterministic Jest UID when an old token lacks the platform claim", async () => {
    /** Provides r id. */
    const userId = `jest_${"a".repeat(40)}`;
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: userId, token: {}},
        data: {},
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});

    expect(mockJestDeletionSet).not.toHaveBeenCalled();
    expect(mockPreserveDeletedJestAuthUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects a Jest claim that is not bound to the authenticated deterministic UID", async () => {
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: jestFirebaseUid("player-a"), token: {jestPlayerId: "player-b"}},
        data: {},
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});

    expect(mockJestDeletionSet).not.toHaveBeenCalled();
    expect(mockPreserveDeletedJestAuthUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("does not release a username reservation owned by another user", async () => {
    mockReservationOwner = "another-user";

    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {},
      }),
    ).resolves.toEqual({success: true});

    expect(mockTransactionDelete).not.toHaveBeenCalledWith({
      path: `usernameReservations/${createUsernameReservationId("Player One")}`,
    });
    expect(mockTransactionDelete).toHaveBeenCalledWith({path: "users/user-1"});
  });

  it("is idempotent when the Firebase Auth identity is already absent", async () => {
    mockDeleteUser.mockRejectedValue({code: "auth/user-not-found"});
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {},
      }),
    ).resolves.toEqual({success: true});
  });

  it("continues when the project has no Firebase Storage bucket", async () => {
    mockDeleteFiles.mockRejectedValue({code: 404});
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {},
      }),
    ).resolves.toEqual({success: true});
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("maps unexpected deletion failures to an internal callable error", async () => {
    mockRecursiveDelete.mockRejectedValue(new Error("Firestore unavailable"));
    await expect(
      (deleteAccount as unknown as (request: unknown) => Promise<unknown>)({
        auth: {uid: "user-1", token: {}},
        data: {},
      }),
    ).rejects.toEqual(expect.objectContaining({code: "internal"}));
    expect(mockLoggerError).toHaveBeenCalledWith("Account deletion failed.", {errorClass: "Error"});
    expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain("user-1");
    expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain("Firestore unavailable");
  });
});
