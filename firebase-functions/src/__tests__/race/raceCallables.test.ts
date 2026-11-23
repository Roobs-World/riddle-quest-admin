/** Provides service mocks behavior. */
const serviceMocks = {
  abandonRaceRunForUser: jest.fn(),
  getRaceChallengePreview: jest.fn(),
  getRaceChallengeForUser: jest.fn(),
  getRaceOutcomeForUser: jest.fn(),
  listRaceCategoriesForLocale: jest.fn(),
  listRaceInboxForUser: jest.fn(),
  publishRaceChallengeForUser: jest.fn(),
  reserveRaceInviteForUser: jest.fn(),
  claimRaceInviteForUser: jest.fn(),
  requestRaceHintForUser: jest.fn(),
  resumeRaceRunForUser: jest.fn(),
  skipRaceRiddleForUser: jest.fn(),
  startRaceRunForUser: jest.fn(),
  submitRaceGuessForUser: jest.fn(),
  getRaceAccessForUser: jest.fn(),
  recordRaceAnalyticsForUser: jest.fn(),
};
/** Provides mock assert race access behavior. */
const mockAssertRaceAccess = jest.fn();
/** Authenticated identity is asserted at the generic selector seam. */
const mockFindRecordedRaceMatch = jest.fn();
/** Invitation authority adapters must receive only authenticated identities. */
const mockGetRaceEntryForUser = jest.fn();
/** Creator cancellation is a separate idempotent authority mutation. */
const mockCancelRaceInviteForUser = jest.fn();
jest.mock("../../race/raceInvitation", () => ({getRaceEntryForUser: mockGetRaceEntryForUser, cancelRaceInviteForUser: mockCancelRaceInviteForUser}));
jest.mock("../../race/raceMatchmaking", () => ({findRecordedRaceMatch: mockFindRecordedRaceMatch}));
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

jest.mock("../../shared/accountDeletion", () => ({
  ...jest.requireActual<typeof import("../../shared/accountDeletion")>("../../shared/accountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual behavior. */
  const actual = jest.requireActual("firebase-functions/v2/https") as {
    /** Stores https error. */
    HttpsError: unknown;
  };
  return {
    HttpsError: actual.HttpsError,
    onCall: jest.fn((options: unknown, handler: object) => Object.assign(handler, {deploymentOptions: options})),
  };
});

jest.mock("../../race/raceService", () => ({
  abandonRaceRunForUser: serviceMocks.abandonRaceRunForUser,
  getRaceChallengePreview: serviceMocks.getRaceChallengePreview,
  getRaceChallengeForUser: serviceMocks.getRaceChallengeForUser,
  getRaceOutcomeForUser: serviceMocks.getRaceOutcomeForUser,
  listRaceCategoriesForLocale: serviceMocks.listRaceCategoriesForLocale,
  listRaceInboxForUser: serviceMocks.listRaceInboxForUser,
  publishRaceChallengeForUser: serviceMocks.publishRaceChallengeForUser,
  reserveRaceInviteForUser: serviceMocks.reserveRaceInviteForUser,
  claimRaceInviteForUser: serviceMocks.claimRaceInviteForUser,
  requestRaceHintForUser: serviceMocks.requestRaceHintForUser,
  resumeRaceRunForUser: serviceMocks.resumeRaceRunForUser,
  skipRaceRiddleForUser: serviceMocks.skipRaceRiddleForUser,
  startRaceRunForUser: serviceMocks.startRaceRunForUser,
  submitRaceGuessForUser: serviceMocks.submitRaceGuessForUser,
}));

jest.mock("../../race/raceRollout", () => ({
  assertRaceAccess: mockAssertRaceAccess,
  getRaceAccessForUser: serviceMocks.getRaceAccessForUser,
  recordRaceAnalyticsForUser: serviceMocks.recordRaceAnalyticsForUser,
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {
  abandonRaceRun,
  getRaceAccess,
  findRaceMatch,
  getRaceChallenge,
  getRaceEntry,
  cancelRaceInvite,
  getRaceOutcome,
  listRaceCategories,
  listRaceInbox,
  publishRaceChallenge,
  reserveRaceInvite,
  raceAbandonCallableOptions,
  raceHintCallableOptions,
  raceStartCallableOptions,
  recordRaceAnalytics,
  requestRaceHint,
  resumeRaceRun,
  skipRaceRiddle,
  startRaceRun,
  readyRaceRun,
  submitRaceGuess,
} from "../../race/raceCallables";
import {createRaceCallableCases, type RaceCallableHandlers} from "./callableCases";
import {raceCallableUserId, raceRunResponseFixture, raceChallengePreviewFixture} from "./callableFixtures";

/** Handles rs. */
const handlers = {
  abandonRaceRun,
  getRaceAccess,
  getRaceChallenge,
  getRaceOutcome,
  listRaceCategories,
  listRaceInbox,
  publishRaceChallenge,
  reserveRaceInvite,
  recordRaceAnalytics,
  requestRaceHint,
  resumeRaceRun,
  skipRaceRiddle,
  startRaceRun,
  submitRaceGuess,
} as unknown as RaceCallableHandlers;
/** Provides callable cases behavior. */
const callableCases = createRaceCallableCases(handlers, serviceMocks);

/** Provides authenticated request behavior. */
const authenticatedRequest = (data: unknown): CallableRequest<unknown> =>
  ({auth: {uid: raceCallableUserId}, data}) as CallableRequest<unknown>;

describe("Race callable deployment options", () => {
  it.each([
    ["listRaceCategories", listRaceCategories], ["submitRaceGuess", submitRaceGuess],
    ["skipRaceRiddle", skipRaceRiddle], ["resumeRaceRun", resumeRaceRun],
    ["getRaceOutcome", getRaceOutcome], ["listRaceInbox", listRaceInbox],
    ["recordRaceAnalytics", recordRaceAnalytics],
  ])("keeps interactive %s available without a cold start", (_name, handler) => {
    expect((handler as unknown as {
      /** Captured callable provisioning options. */
      deploymentOptions: unknown;
    }).deploymentOptions)
      .toMatchObject({minInstances: 0, invoker: "public", enforceAppCheck: true});
  });

  it.each([["findRaceMatch", findRaceMatch], ["recordRaceAnalytics", recordRaceAnalytics]])(
    "deploys %s beside eur3 while retaining the existing endpoint", (_name, handler) => {
      expect((handler as unknown as {
        /** Captured callable provisioning options for both supported backend regions. */
        deploymentOptions: unknown;
      }).deploymentOptions)
        .toMatchObject({region: ["us-central1", "europe-west1"], minInstances: 0, invoker: "public", enforceAppCheck: true});
    });

  it.each([
    ["getRaceAccess", getRaceAccess],
    ["listRaceCategories", listRaceCategories],
    ["startRaceRun", startRaceRun],
    ["readyRaceRun", readyRaceRun],
    ["submitRaceGuess", submitRaceGuess],
    ["requestRaceHint", requestRaceHint],
    ["skipRaceRiddle", skipRaceRiddle],
    ["resumeRaceRun", resumeRaceRun],
    ["abandonRaceRun", abandonRaceRun],
    ["publishRaceChallenge", publishRaceChallenge],
    ["reserveRaceInvite", reserveRaceInvite],
    ["getRaceChallenge", getRaceChallenge],
    ["getRaceOutcome", getRaceOutcome],
    ["listRaceInbox", listRaceInbox],
    ["getRaceEntry", getRaceEntry],
    ["cancelRaceInvite", cancelRaceInvite],
  ])("colocates multiplayer %s without dropping the existing endpoint", (_name, handler) => {
    expect((handler as unknown as {
      /** Captured deployment boundary for all multiplayer operations. */
      deploymentOptions: unknown;
    }).deploymentOptions).toMatchObject({region: ["us-central1", "europe-west1"], invoker: "public", enforceAppCheck: true});
  });

  it("keeps the latency-sensitive abandon callable warm", () => {
    expect(raceAbandonCallableOptions).toMatchObject({minInstances: 0, invoker: "public"});
  });

  it("keeps the latency-sensitive hint callable warm", () => {
    expect(raceHintCallableOptions).toMatchObject({minInstances: 0, invoker: "public"});
  });

  it("keeps the countdown-critical start callable warm", () => {
    expect(raceStartCallableOptions).toMatchObject({minInstances: 0, invoker: "public"});
  });
});

describe("Race callable methods", () => {
  beforeEach(() => {
    mockFindRecordedRaceMatch.mockReset();
    mockAssertRaceAccess.mockResolvedValue(undefined);
    serviceMocks.claimRaceInviteForUser.mockResolvedValue(false);
    serviceMocks.getRaceChallengeForUser.mockReset();
  });

  it.each(["data-loss", "permission-denied", "storage-outage"])("legacy preview uses authenticated admission rather than a detached metadata read: %s", async code => {
    /** A user-bound authority rejection must survive the legacy response adapter unchanged. */
    const failure = Object.assign(new Error("Owned fixture admission failure"), {code});
    serviceMocks.getRaceChallengeForUser.mockRejectedValueOnce(failure);
    serviceMocks.getRaceChallengePreview.mockResolvedValueOnce(raceChallengePreviewFixture);
    await expect(getRaceChallenge(authenticatedRequest({challengeId: "challenge-1", locale: "en"}))).rejects.toBe(failure);
    expect(serviceMocks.getRaceChallengeForUser).toHaveBeenCalledWith(raceCallableUserId, "challenge-1", "en");
    expect(serviceMocks.claimRaceInviteForUser).not.toHaveBeenCalled();expect(serviceMocks.getRaceChallengePreview).not.toHaveBeenCalled();
  });

  it("binds recorded matchmaking to authenticated identity and validated preferences", async () => {
    mockFindRecordedRaceMatch.mockResolvedValueOnce({status: "empty", locale: "en"});
    /** Provides input behavior. */
    const input = {locale: "en", categoryId: "history", requestId: "match-request"};
    await expect(findRaceMatch(authenticatedRequest(input))).resolves.toEqual({status: "empty", locale: "en"});
    expect(mockFindRecordedRaceMatch).toHaveBeenCalledWith(raceCallableUserId, input);
    expect(mockAssertRaceAccess).toHaveBeenCalledWith(raceCallableUserId, "en");
  });

  it("authenticates and validates typed invitation reads and creator cancellation", async () => {
    /** Waiting facts contain no private player identities. */
    const waiting = {status: "waiting", serverNowMs: 10000, invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 20000}};
    mockGetRaceEntryForUser.mockResolvedValueOnce(waiting);
    await expect(getRaceEntry(authenticatedRequest({challengeId: "opaque-seat", locale: "en"}))).resolves.toEqual(waiting);
    expect(mockGetRaceEntryForUser).toHaveBeenCalledWith(raceCallableUserId, "opaque-seat", "en",
      {includeViewerRole: undefined, includeExistingAttempt: undefined});
    /** Stable cancellation receipt belongs to the authenticated creator. */
    const cancellation = {challengeId: "opaque-seat", locale: "en", requestId: "cancel-seat-1"};
    mockCancelRaceInviteForUser.mockResolvedValueOnce({status: "cancelled", serverNowMs: 10000});
    await expect(cancelRaceInvite(authenticatedRequest(cancellation))).resolves.toMatchObject({status: "cancelled"});
    expect(mockCancelRaceInviteForUser).toHaveBeenCalledWith(raceCallableUserId, cancellation);
    await expect(cancelRaceInvite(authenticatedRequest({challengeId: "opaque-seat", locale: "en"}))).rejects.toMatchObject({code: "invalid-argument"});
    await expect(getRaceEntry({auth: undefined, data: {challengeId: "opaque-seat", locale: "en"}} as CallableRequest<unknown>)).rejects.toMatchObject({code: "unauthenticated"});
    await expect(getRaceEntry(authenticatedRequest({challengeId: "opaque-seat", locale: "en", creatorId: "victim"}))).rejects.toMatchObject({code: "invalid-argument"});
  });

  it.each([
    {includeViewerRole: true}, {includeViewerRole: false}, {includeExistingAttempt: true},
    {includeExistingAttempt: false}, {includeViewerRole: true, includeExistingAttempt: true},
  ])("forwards validated invitation recovery preferences with authenticated identity: %j", async preferences => {
    /** Provider options do not alter the authenticated user bound to the entry lookup. */
    const response = {status: "unavailable", reason: "missing", serverNowMs: 10000};
    mockGetRaceEntryForUser.mockResolvedValueOnce(response);
    await expect(getRaceEntry(authenticatedRequest({challengeId: "opaque-seat", locale: "en", ...preferences}))).resolves.toEqual(response);
    expect(mockGetRaceEntryForUser).toHaveBeenLastCalledWith(raceCallableUserId, "opaque-seat", "en", {
      includeViewerRole: preferences.includeViewerRole, includeExistingAttempt: preferences.includeExistingAttempt,
    });
  });

  it.each([
    {includeViewerRole: "yes"}, {includeExistingAttempt: "foreign-run"},
    {includeExistingAttempt: {runId: "foreign-run"}}, {includeExistingAttempt: true, runId: "foreign-run"},
  ])("rejects malformed or client-selected recovery pointers before authority: %j", async preferences => {
    mockGetRaceEntryForUser.mockClear();
    await expect(getRaceEntry(authenticatedRequest({challengeId: "opaque-seat", locale: "en", ...preferences})))
      .rejects.toMatchObject({code: "invalid-argument"});
    expect(mockGetRaceEntryForUser).not.toHaveBeenCalled();
  });

  it("rejects client-authored provider scope and player identity", async () => {
    await expect(findRaceMatch(authenticatedRequest({locale: "en", provider: "facebook", userId: "victim"})))
      .rejects.toMatchObject({code: "invalid-argument"});
    expect(mockFindRecordedRaceMatch).not.toHaveBeenCalled();
  });

  it.each(callableCases)("$name rejects unauthenticated requests", async ({handler, input}) => {
    await expect(handler({auth: undefined, data: input} as CallableRequest<unknown>)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it.each(callableCases)("$name rejects invalid request payloads", async ({handler, serviceMock}) => {
    await expect(handler(authenticatedRequest({unexpected: true}))).rejects.toMatchObject({code: "invalid-argument"});
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "startRaceRun",
      handler: startRaceRun,
      serviceMock: serviceMocks.startRaceRunForUser,
      input: {
        locale: "en",
        categoryId: "history",
        requestId: "request-0001",
        startedAtMs: 1,
        deckId: "client-deck",
      },
    },
    {
      name: "submitRaceGuess",
      handler: submitRaceGuess,
      serviceMock: serviceMocks.submitRaceGuessForUser,
      input: {
        runId: "run-1",
        riddleId: "riddle-1",
        guess: "piano",
        requestId: "request-0001",
        isCorrect: true,
        elapsedMs: 1,
      },
    },
    {
      name: "requestRaceHint",
      handler: requestRaceHint,
      serviceMock: serviceMocks.requestRaceHintForUser,
      input: {
        runId: "run-1",
        riddleId: "riddle-1",
        requestId: "request-0001",
        currentAttempt: ["p", "", "", "", ""],
        revealedLetter: "p",
      },
    },
    {
      name: "skipRaceRiddle",
      handler: skipRaceRiddle,
      serviceMock: serviceMocks.skipRaceRiddleForUser,
      input: {
        runId: "run-1",
        riddleId: "riddle-1",
        requestId: "request-0001",
        penaltyAddedMs: 0,
      },
    },
    {
      name: "publishRaceChallenge",
      handler: publishRaceChallenge,
      serviceMock: serviceMocks.publishRaceChallengeForUser,
      input: {
        runId: "run-1",
        requestId: "request-0001",
        adjustedFinishMs: 1,
        achievementCoinsAwarded: 999_999,
      },
    },
  ])("$name rejects client-authored multiplayer state", async ({handler, input, serviceMock}) => {
    await expect(handler(authenticatedRequest(input))).rejects.toMatchObject({code: "invalid-argument"});
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it.each(callableCases)(
    "$name validates and delegates a successful request",
    async ({handler, input, serviceMock, response, expectedCall, accessCall}) => {
      serviceMock.mockResolvedValueOnce(response);

      await expect(handler(authenticatedRequest(input))).resolves.toEqual(response);
      expect(serviceMock).toHaveBeenCalledWith(...expectedCall);
      if (accessCall) expect(mockAssertRaceAccess).toHaveBeenCalledWith(...accessCall);
    },
  );

  it.each(callableCases)("$name rejects invalid service responses", async ({handler, input, serviceMock}) => {
    serviceMock.mockResolvedValueOnce({unexpected: true});
    await expect(handler(authenticatedRequest(input))).rejects.toMatchObject({code: "internal"});
  });
});

it("negotiates confirmed history only for an explicitly opted-in authenticated resume", async () => {
  serviceMocks.resumeRaceRunForUser.mockResolvedValueOnce(raceRunResponseFixture);
  await expect(resumeRaceRun(authenticatedRequest({runId: "run-1", includeGuessHistory: true}))).resolves.toEqual(raceRunResponseFixture);
  expect(serviceMocks.resumeRaceRunForUser).toHaveBeenLastCalledWith(raceCallableUserId, "run-1",
    {includeEvaluation: undefined, includeGuessHistory: true});
});
