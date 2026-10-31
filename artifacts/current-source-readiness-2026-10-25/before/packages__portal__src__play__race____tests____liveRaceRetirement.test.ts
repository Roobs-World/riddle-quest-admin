import {LiveRaceViewSchema, RACE_RULES, type LiveRaceView, type UpdateLiveRace, type RetireLiveRaceJoinResponse} from "@qwordly/core/race";
import {createLiveRaceRetirement} from "../logic/liveRaceRetirement";

/** Valid server receipts distinguish owned confirmation from unrelated terminal seats. */
const view = (phase: LiveRaceView["phase"] = "searching", ticketId = "a".repeat(64)) => LiveRaceViewSchema.parse({
  ticketId, phase, serverNowMs: 1000, searchEndsAtMs: 61000, startsAtMs: null,
  player: {displayName: "Owner", avatarUrl: null, bot: false, correctCount: 0},
  opponent: null, run: null, result: null, rewardCoins: 0,
});

describe("durable original-join retirement", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each(["retired", "superseded"])("retires before a ticket receipt and accepts %s without a leave", async status => {
    /** Approved target method owns the original intent, while ticket updates remain untouched. */
    const retireJoin = jest.fn().mockResolvedValue({status}), update = jest.fn();
    createLiveRaceRetirement({retireJoin, update}, "old-leave-id", "original-join-id", "original-owner")(null);
    await jest.advanceTimersByTimeAsync(60000);
    expect(retireJoin).toHaveBeenCalledWith({requestId: "original-join-id", expectedOwnerId: "original-owner"});
    expect(retireJoin).toHaveBeenCalledTimes(1); expect(update).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });
  it("late canonical ticket receipts coalesce with retirement already in progress", async () => {
    /** Failed initial transport is followed by a valid durable marker acknowledgement. */
    const retireJoin = jest.fn().mockRejectedValueOnce({code: "functions/unavailable"}).mockResolvedValue({status: "superseded"}), update = jest.fn();
    /** All receipts belong to one original join, even when the server recovered another ticket ID. */
    const retire = createLiveRaceRetirement({retireJoin, update}, "old-leave-id", "original-join-id", "original-owner");
    retire(null); retire(view()); retire(view("searching", "b".repeat(64))); await jest.advanceTimersByTimeAsync(1000);
    expect(retireJoin).toHaveBeenCalledTimes(2); expect(retireJoin.mock.calls[0]).toEqual(retireJoin.mock.calls[1]);
    retire(view()); await jest.advanceTimersByTimeAsync(60000);
    expect(retireJoin).toHaveBeenCalledTimes(2); expect(update).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });
  it("captures the original retirement method and expected account", async () => {
    /** Capability mutation cannot redirect a retired account's next delivery. */
    const original = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({status: "retired"}), replacement = jest.fn(), update = jest.fn();
    /** Expected account is copied at creation rather than sampled from replacement UI. */
    const transport = {retireJoin: original, update}, retire = createLiveRaceRetirement(transport, "old-leave-id", "original-join-id", "original-owner");
    retire(null); transport.retireJoin = replacement; await jest.advanceTimersByTimeAsync(1000);
    expect(original).toHaveBeenCalledTimes(2); expect(replacement).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
    expect(original.mock.calls[1][0].expectedOwnerId).toBe("original-owner");
  });
  it.each(["unauthenticated", "functions/permission-denied"])("stops account replacement rejection %s without a fallback leave", async code => {
    /** The server refuses to write when authentication no longer matches the original account. */
    const retireJoin = jest.fn().mockRejectedValue({code}), update = jest.fn();
    createLiveRaceRetirement({retireJoin, update}, "old-leave-id", "original-join-id", "original-owner")(null);
    await jest.advanceTimersByTimeAsync(60000); expect(retireJoin).toHaveBeenCalledTimes(1); expect(update).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });
  it("bounds malformed acknowledgements without trusting gameplay fields", async () => {
    /** A status plus hidden ticket fields is not the strict retirement contract. */
    const retireJoin = jest.fn().mockResolvedValue({status: "retired", ticketId: "a".repeat(64)}), update = jest.fn();
    createLiveRaceRetirement({retireJoin, update}, "old-leave-id", "original-join-id")(null);
    await jest.advanceTimersByTimeAsync(60000); expect(retireJoin).toHaveBeenCalledTimes(4); expect(update).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });
});
/** An original SDK receipt may settle after local retirement delivery has timed out. */
const deferred = () => {
  /** Retained authority response exposed independently of the browser timer. */
  let resolve!: (value: LiveRaceView) => void;
  /** Original provider promise keeps its observer after the cleanup deadline. */
  const promise = new Promise<LiveRaceView>(yes => {resolve = yes;});
  return {promise, resolve};
};

describe("owned live seat retirement", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("retries transient failure with the original ticket and leave identity", async () => {
    /** A failed request precedes one confirmed cancellation. */
    const update = jest.fn<Promise<LiveRaceView>, [UpdateLiveRace]>().mockRejectedValueOnce({code: "functions/unavailable"}).mockResolvedValue(view("cancelled"));
    /** Retired cleanup owns no mounted component callback. */
    const retire = createLiveRaceRetirement({update}, "original-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(999);
    expect(update).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls.map(([command]) => command)).toEqual(Array(2).fill({ticketId: "a".repeat(64), action: "leave", requestId: "original-leave-id"}));
    expect(jest.getTimerCount()).toBe(0);
  });
  it("coalesces duplicate cleanup paths while a request or backoff owns delivery", async () => {
    /** Held request permits duplicate late joins and unmount cleanup. */
    const first = deferred(), update = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(view("cancelled"));
    /** Every cleanup observation belongs to the same retired journey. */
    const retire = createLiveRaceRetirement({update}, "shared-leave-id");
    retire(view()); retire(view()); await jest.advanceTimersByTimeAsync(10000);
    retire(view()); await jest.advanceTimersByTimeAsync(1000);
    expect(update).toHaveBeenCalledTimes(2);
    retire(view()); await jest.advanceTimersByTimeAsync(60000);
    expect(update).toHaveBeenCalledTimes(2); expect(jest.getTimerCount()).toBe(0);
    first.resolve(view("cancelled")); await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(["cancelled", "result"] as const)("late %s confirmation releases a scheduled retry", async phase => {
    /** Original server mutation succeeds after its local deadline. */
    const first = deferred(), update = jest.fn().mockReturnValue(first.promise);
    /** Only the original terminal receipt may stop its ticket's cleanup. */
    const retire = createLiveRaceRetirement({update}, "late-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(10000);
    expect(jest.getTimerCount()).toBe(1);
    first.resolve(view(phase)); await jest.advanceTimersByTimeAsync(60000);
    expect(update).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  });
  it("late confirmation releases a newer never-settling retry deadline", async () => {
    /** First and repeated authority deliveries remain independent. */
    const first = deferred(), second = deferred(), update = jest.fn().mockReturnValueOnce(first.promise).mockReturnValue(second.promise);
    createLiveRaceRetirement({update}, "overlap-leave-id")(view());
    await jest.advanceTimersByTimeAsync(11000); expect(update).toHaveBeenCalledTimes(2);
    first.resolve(view("cancelled")); await jest.advanceTimersByTimeAsync(60000);
    expect(update).toHaveBeenCalledTimes(2); expect(jest.getTimerCount()).toBe(0);
    second.resolve(view("searching")); await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(2);
  });
  it.each(["permission-denied", "functions/unauthenticated", "not-found", "functions/invalid-argument", "failed-precondition"])("does not retry definitive %s rejection", async code => {
    /** Authority denial is final even if older nonterminal snapshots arrive. */
    const update = jest.fn().mockRejectedValue({code}), retire = createLiveRaceRetirement({update}, "denied-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(60000); retire(view());
    expect(update).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  });
  it.each(["reject", "hang", "nonterminal", "foreign"])("exhausts finite recovery without retaining timers (%s)", async kind => {
    /** Outage and unsuitable receipts cannot create an unbounded detached request loop. */
    const update = jest.fn(() => kind === "reject" ? Promise.reject(new Error("offline")) : kind === "hang" ? new Promise<LiveRaceView>(() => {}) : Promise.resolve(view(kind === "foreign" ? "cancelled" : "searching", kind === "foreign" ? "b".repeat(64) : "a".repeat(64))));
    /** Repeated old observations cannot restart an exhausted recovery budget. */
    const retire = createLiveRaceRetirement({update}, "bounded-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(60000); retire(view());
    expect(update).toHaveBeenCalledTimes(4); expect(jest.getTimerCount()).toBe(0);
  });
  it("captures the original method even when its capability is replaced", async () => {
    /** Original provider must receive its own authenticated seat cleanup. */
    const original = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(view("cancelled")), replacement = jest.fn();
    /** Capability mutation cannot redirect old-account recovery. */
    const transport = {update: original}, retire = createLiveRaceRetirement(transport, "captured-leave-id");
    retire(view()); transport.update = replacement; await jest.advanceTimersByTimeAsync(1000);
    expect(original).toHaveBeenCalledTimes(2); expect(replacement).not.toHaveBeenCalled();
  });
  it("does not deliver for an already terminal seat or revive it with a stale receipt", async () => {
    /** Terminal knowledge supersedes an old nonterminal snapshot. */
    const update = jest.fn(), retire = createLiveRaceRetirement({update}, "terminal-leave-id");
    retire(view("cancelled")); retire(view()); await jest.advanceTimersByTimeAsync(60000);
    expect(update).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });
  it("observed terminal state stops backoff independently of a leave receipt", async () => {
    /** A late join or poll can independently prove the owned seat is terminal. */
    const update = jest.fn().mockRejectedValue(new Error("offline")), retire = createLiveRaceRetirement({update}, "observed-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(1); retire(view("result"));
    await jest.advanceTimersByTimeAsync(60000);
    expect(update).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  });
  it("bounds synchronous adapter failures as well as rejected promises", async () => {
    /** Target adapters can throw before producing a promise. */
    const update = jest.fn(() => {throw new Error("SDK unavailable");});
    createLiveRaceRetirement({update}, "sync-leave-id")(view());
    await jest.advanceTimersByTimeAsync(60000);
    expect(update).toHaveBeenCalledTimes(4); expect(jest.getTimerCount()).toBe(0);
  });
  it("accepts the owner's completed run while the rival retains a finish opportunity", async () => {
    /** Accepted leave cannot forfeit an already completed run or shorten the opponent's race. */
    const completed = LiveRaceViewSchema.parse({...view("racing"), startsAtMs: 0, run: {
      runId: "a".repeat(64), role: "creator", status: "completed", serverNowMs: 1000, startsAtMs: 0,
      categoryId: "mixed", locale: "en", rules: RACE_RULES, correctCount: 10, wallElapsedMs: 1000,
      totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [], currentRiddle: null,
    }});
    /** Owner completion is sufficient even though the whole match has not settled. */
    const update = jest.fn().mockResolvedValue(completed), retire = createLiveRaceRetirement({update}, "completed-leave-id");
    retire(view()); await jest.advanceTimersByTimeAsync(60000); retire(view());
    expect(update).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  });
});

describe("explicit retirement confirmation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("coalesces callers and resolves only after the original join is confirmed", async () => {
    const releases: ((value: RetireLiveRaceJoinResponse) => void)[] = [];
    const retireJoin = jest.fn(() => new Promise<RetireLiveRaceJoinResponse>(resolve => releases.push(resolve)));
    const update = jest.fn();
    const retire = createLiveRaceRetirement({retireJoin, update}, "original-leave-key", "original-join-key", "original-owner");
    const completion = retire(null);
    expect(retire(view())).toBe(completion);
    let resolved = false;
    const observation = completion.then(confirmed => {resolved = confirmed;});
    await jest.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
    expect(retireJoin).toHaveBeenCalledTimes(1);
    expect(retireJoin).toHaveBeenCalledWith({requestId: "original-join-key", expectedOwnerId: "original-owner"});
    for (const release of releases) release({status: "retired"});
    await expect(completion).resolves.toBe(true);
    await observation;
    expect(resolved).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("returns false after exhaustion and permits explicit retry with the original key", async () => {
    const retireJoin = jest.fn().mockRejectedValue(new Error("offline"));
    const retire = createLiveRaceRetirement({retireJoin, update: jest.fn()}, "original-leave-key", "original-join-key", "original-owner");
    const completion = retire(null);
    await jest.advanceTimersByTimeAsync(60000);
    await expect(completion).resolves.toBe(false);
    expect(retireJoin).toHaveBeenCalledTimes(4);
    expect(retire(view())).toBe(completion);
    retireJoin.mockResolvedValue({status: "retired"});
    const retried = retire(null, {retry: true});
    expect(retried).not.toBe(completion);
    await expect(retried).resolves.toBe(true);
    expect(retireJoin).toHaveBeenCalledTimes(5);
    expect(retireJoin.mock.calls.every(([input]) => input.requestId === "original-join-key" && input.expectedOwnerId === "original-owner")).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps a definitive failure closed until explicit same-key retry confirms", async () => {
    const retireJoin = jest.fn().mockRejectedValueOnce({code: "functions/permission-denied"}).mockResolvedValue({status: "superseded"});
    const retire = createLiveRaceRetirement({retireJoin, update: jest.fn()}, "original-leave-key", "original-join-key", "original-owner");
    const completion = retire(null);
    await expect(completion).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(60000);
    expect(retireJoin).toHaveBeenCalledTimes(1);
    await expect(retire(null, {retry: true})).resolves.toBe(true);
    expect(retireJoin.mock.calls).toEqual([
      [{requestId: "original-join-key", expectedOwnerId: "original-owner"}],
      [{requestId: "original-join-key", expectedOwnerId: "original-owner"}],
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("publishes the shared promise before a synchronous adapter reenters cleanup", async () => {
    const observations: Promise<boolean>[] = [];
    const retireJoin = jest.fn(() => {
      observations.push(retire(view()));
      return Promise.resolve({status: "retired"} satisfies RetireLiveRaceJoinResponse);
    });
    const retire = createLiveRaceRetirement({retireJoin, update: jest.fn()}, "original-leave-key", "original-join-key", "original-owner");
    const completion = retire(null);
    await expect(completion).resolves.toBe(true);
    expect(observations).toHaveLength(1);
    for (const observation of observations) expect(observation).toBe(completion);
    expect(retireJoin).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
