/** Provides mock join behavior. */
const mockJoin = jest.fn();
/** Provides mock leave behavior. */
const mockLeave = jest.fn();
/** Provides mock record board behavior. */
const mockRecordBoard = jest.fn();
/** Provides mock list board behavior. */
const mockListBoard = jest.fn();
/** Provides mock enabled behavior. */
const mockEnabled = jest.fn(() => true);

jest.mock("../../../../../../firebase-functions/src/shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));
jest.mock("../../race/facebookContextService", () => ({
  joinFacebookContextCompetition: (...args: unknown[]) => mockJoin(...args),
  leaveFacebookContextCompetition: (...args: unknown[]) => mockLeave(...args),
}));
jest.mock("../../race/facebookContextBoard", () => ({
  FACEBOOK_CONTEXT_BOARD_SORT_ORDER: "LOWER_IS_BETTER",
  recordFacebookContextBoardRun: (...args: unknown[]) => mockRecordBoard(...args),
  listFacebookContextBoard: (...args: unknown[]) => mockListBoard(...args),
}));
jest.mock("../../facebookFeatureFlags", () => ({
  isFacebookFeatureEnabled: (...args: unknown[]) => mockEnabled(...args),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {
  joinFacebookContext,
  leaveFacebookContext,
  listFacebookContextBoard,
  recordFacebookContextRun,
} from "../../race/facebookContextCallables";

/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides auth behavior. */
const auth = {uid, token: {provider: "facebook"}};
/** Provides call behavior. */
const call = (handler: unknown, data: unknown, identity: unknown = auth) =>
  (handler as (request: CallableRequest<unknown>) => Promise<unknown>)({
    data,
    auth: identity,
  } as CallableRequest<unknown>);

describe("Facebook context callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnabled.mockReturnValue(true);
    mockJoin.mockResolvedValue({contextKey: "hash"});
    mockLeave.mockResolvedValue({contextKey: "hash"});
    mockRecordBoard.mockResolvedValue({
      entry: {
        locale: "ja",
        runId: "run-1",
        adjustedTimeMs: 30_000,
        completedAtMs: 40_000,
      },
      improved: true,
    });
    mockListBoard.mockResolvedValue({
      locale: "ja",
      startsAtMs: 1,
      endsAtMs: 2,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
      standings: [{rank: 1, adjustedTimeMs: 30_000, isCurrentPlayer: true}],
      currentPlayer: {rank: 1, adjustedTimeMs: 30_000, isCurrentPlayer: true},
    });
  });

  it("records and lists only strict identity-free authoritative context-board data", async () => {
    await expect(
      call(recordFacebookContextRun, {
        contextId: "context-1",
        locale: "ja",
        runId: "run-1",
      }),
    ).resolves.toEqual({
      locale: "ja",
      runId: "run-1",
      adjustedTimeMs: 30_000,
      completedAtMs: 40_000,
      improved: true,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
    });
    expect(mockRecordBoard).toHaveBeenCalledWith(uid, {
      contextId: "context-1",
      locale: "ja",
      runId: "run-1",
    });
    /** Lists ed. */
    const listed = await call(listFacebookContextBoard, {contextId: "context-1", locale: "ja"});
    expect(listed).toMatchObject({standings: [{rank: 1, isCurrentPlayer: true}], rewardsEnabled: false});
    expect(JSON.stringify(listed)).not.toContain(uid);
    await expect(
      call(recordFacebookContextRun, {
        contextId: "context-1",
        locale: "ja",
        runId: "run-1",
        score: 1,
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("requires Facebook claims and independently honors the matchmaking switch", async () => {
    await expect(call(joinFacebookContext, {}, null)).rejects.toMatchObject({code: "unauthenticated"});
    await expect(call(joinFacebookContext, {}, {uid, token: {provider: "reddit"}})).rejects.toMatchObject({
      code: "unauthenticated",
    });
    mockEnabled.mockReturnValue(false);
    await expect(
      call(joinFacebookContext, {
        contextId: "context-1",
        contextType: "THREAD",
        locale: "en",
      }),
    ).rejects.toMatchObject({code: "unavailable"});
  });

  it("accepts only strict context, type, and supported locale fields", async () => {
    await expect(
      call(joinFacebookContext, {
        contextId: "context-1",
        contextType: "GROUP",
        locale: "ja",
      }),
    ).resolves.toEqual({contextKey: "hash"});
    expect(mockJoin).toHaveBeenCalledWith({
      userId: uid,
      contextId: "context-1",
      contextType: "GROUP",
      locale: "ja",
    });
    await expect(
      call(joinFacebookContext, {
        contextId: "context-1",
        contextType: "GROUP",
        locale: "xx",
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
    await expect(
      call(joinFacebookContext, {
        contextId: "context/escape",
        contextType: "GROUP",
        locale: "en",
        memberId: "victim",
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
    await expect(call(leaveFacebookContext, {contextId: "context-1"})).resolves.toEqual({contextKey: "hash"});
    expect(mockLeave).toHaveBeenCalledWith({userId: uid, contextId: "context-1"});
  });
});
