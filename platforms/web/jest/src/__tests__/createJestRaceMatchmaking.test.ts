import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {LiveRaceView} from "../../../../../src/races/contracts/index";
import type {blockRival, joinLiveRace, reportRival} from "../../../../../src/platform/firebase/browserClient";

/** Transport responses remain untrusted until the real adapter validates them. */
type CallableReply = {
  /** Raw provider data allows malformed-response regression cases. */
  data: unknown;
};
/** Captures the authenticated rematch join without replacing target adapter behavior. */
const mockJoinLiveRace = jest.fn<(...input: Parameters<typeof joinLiveRace>) => Promise<CallableReply>>();
/** Captures ticket-bound blocking at the existing callable boundary. */
const mockBlockRival = jest.fn<(...input: Parameters<typeof blockRival>) => Promise<CallableReply>>();
/** Captures ticket-bound reports at the existing callable boundary. */
const mockReportRival = jest.fn<(...input: Parameters<typeof reportRival>) => Promise<CallableReply>>();

jest.mock("../../../../../src/platform/firebase/browserClient", () => ({joinLiveRace: mockJoinLiveRace, blockRival: mockBlockRival, reportRival: mockReportRival}));
import {createJestRaceMatchmaking} from "../createJestRaceMatchmaking";

/** Server-issued private lobby returned after resolving the original opponent. */
const rematchView: LiveRaceView = {
  ticketId: "b".repeat(64), challengeId: `live_${"c".repeat(64)}`, phase: "searching",
  serverNowMs: 1000, searchEndsAtMs: 901000, startsAtMs: null,
  player: {displayName: "Player One", avatarUrl: null, bot: false, correctCount: 0},
  opponent: null, run: null, result: null, rewardCoins: 0,
};

beforeEach(() => {jest.resetAllMocks();});

describe("Jest live multiplayer capabilities", () => {
  it("blocks and reports the server-resolved opponent using only the player's live seat", async () => {
    /** Actual target factory exposes the safety controls used by shared live gameplay. */
    const live = createJestRaceMatchmaking().live;
    if (!live?.blockOpponent || !live.reportOpponent) throw new Error("Jest live safety is unavailable");
    mockBlockRival.mockResolvedValue({data: {blocked: true}});
    mockReportRival.mockResolvedValue({data: {reportId: "report-1", queued: true}});

    await expect(live.blockOpponent({liveTicketId: "a".repeat(64)})).resolves.toEqual({blocked: true});
    await expect(live.reportOpponent({liveTicketId: "a".repeat(64), category: "harassment", requestId: "report-request-1"}))
      .resolves.toEqual({reportId: "report-1", queued: true});
    expect(mockBlockRival).toHaveBeenCalledWith({liveTicketId: "a".repeat(64)});
    expect(mockReportRival).toHaveBeenCalledWith({liveTicketId: "a".repeat(64), category: "harassment", requestId: "report-request-1"});
    expect(live.history).toBeUndefined();
    expect(live.sendChallenge).toBeUndefined();
  });

  it("creates a human rematch from the owned terminal ticket through authenticated join", async () => {
    /** Actual target factory retains the existing server-owned rematch protocol. */
    const live = createJestRaceMatchmaking().live;
    if (!live?.rematch) throw new Error("Jest live rematch is unavailable");
    mockJoinLiveRace.mockResolvedValue({data: rematchView});

    await expect(live.rematch({locale: "en", categoryId: "history", requestId: "rematch-request-1",
      rematchOfTicketId: "a".repeat(64), retirementAware: true, expectedOwnerId: "jest:player-1"}))
      .resolves.toEqual(rematchView);
    expect(mockJoinLiveRace).toHaveBeenCalledWith({locale: "en", categoryId: "history", requestId: "rematch-request-1",
      rematchOfTicketId: "a".repeat(64), retirementAware: true, expectedOwnerId: "jest:player-1"});
  });

  it("rejects malformed safety acknowledgements and rematch state before they reach gameplay", async () => {
    /** Target adapters apply the shared strict response schemas to provider data. */
    const live = createJestRaceMatchmaking().live;
    if (!live?.blockOpponent || !live.reportOpponent || !live.rematch) throw new Error("Jest live controls are unavailable");
    mockBlockRival.mockResolvedValue({data: {blocked: false}});
    mockReportRival.mockResolvedValue({data: {reportId: "report-1", queued: false}});
    mockJoinLiveRace.mockResolvedValue({data: {...rematchView, answer: "private-answer"}});

    await expect(live.blockOpponent({liveTicketId: "a".repeat(64)})).rejects.toThrow();
    await expect(live.reportOpponent({liveTicketId: "a".repeat(64), category: "spam", requestId: "report-request-2"})).rejects.toThrow();
    await expect(live.rematch({locale: "en", categoryId: "history", requestId: "rematch-request-2", rematchOfTicketId: "a".repeat(64)})).rejects.toThrow();
  });
});
