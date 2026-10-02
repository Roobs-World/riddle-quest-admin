import {REDDIT_HUB_POLL_MS, REDDIT_RACE_POLL_MS, RedditPollingPresence} from "../RedditPollingPresence";
import type {PresenceCapability} from "../../platform/types";

/** Held provider result used to verify that old rival projections cannot outlive consent. */
type HeldRivalResult = {
  /** Rivals returned by the held visible poll. */
  rivals: Array<{
    /** Opaque provider account identifier. */
    userId: string;
    /** Presence state from the old poll. */
    state: "playing";
  }>;
};
/** Empty result acknowledging an ordered revocation write. */
type EmptyRivalResult = {
  /** Revocation returns no visible rivals. */
  rivals: [];
};

describe("Reddit bounded polling presence", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("polls every 10s in the hub and every 2s while racing", async () => {
    /** Provides poll behavior. */
    const poll = jest.fn(async () => ({rivals: []}));
    /** Provides disconnect behavior. */
    const disconnect = jest.fn(async () => undefined);
    /** Provides presence behavior. */
    const presence = new RedditPollingPresence({poll, disconnect} as PresenceCapability, {
      sessionId: "session_123456789",
      visibility: () => "visible",
    });
    await presence.setEnabled(true);
    expect(poll).toHaveBeenLastCalledWith({sessionId: "session_123456789", state: "online", enabled: true});
    await jest.advanceTimersByTimeAsync(REDDIT_HUB_POLL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
    await presence.setState("racing");
    await jest.advanceTimersByTimeAsync(REDDIT_RACE_POLL_MS);
    expect(poll).toHaveBeenCalledTimes(4);
    await presence.stop();
  });

  it("disconnects while hidden, resumes visibly, and clears rivals on opt-out", async () => {
    /** Provides visibility behavior. */
    let visibility: DocumentVisibilityState = "visible";
    /** Provides on rivals behavior. */
    const onRivals = jest.fn();
    /** Provides capability behavior. */
    const capability = {
      poll: jest.fn(async () => ({rivals: [{userId: `reddit_${"b".repeat(40)}`, state: "playing" as const}]})),
      disconnect: jest.fn(async () => undefined),
    };
    /** Provides presence behavior. */
    const presence = new RedditPollingPresence(capability, {
      sessionId: "session_123456789",
      onRivals,
      visibility: () => visibility,
    });
    await presence.setEnabled(true);
    visibility = "hidden";
    await presence.visibilityChanged();
    expect(capability.disconnect).toHaveBeenCalledWith("session_123456789");
    visibility = "visible";
    await presence.visibilityChanged();
    expect(capability.poll).toHaveBeenCalledTimes(2);
    await presence.setEnabled(false);
    expect(capability.poll).toHaveBeenLastCalledWith({sessionId: "session_123456789", state: "online", enabled: false});
    expect(onRivals).toHaveBeenLastCalledWith([]);
  });

  it.each(["opt-out", "hidden", "stop"] as const)("revokes after an in-flight poll without restoring rivals on %s", async (change) => {
    /** Completes the old server write only after consent or visibility changes. */
    let finish!: (result: HeldRivalResult) => void;
    /** The initial request remains pending while the lease is revoked. */
    const pending = new Promise<HeldRivalResult>(resolve => {finish = resolve;});
    /** Simulated host visibility throughout the pending provider operation. */
    let visibility: DocumentVisibilityState = "visible";
    /** Captures user-visible rival projections. */
    const onRivals = jest.fn();
    /** Resolves later control writes immediately, independently of the held first poll. */
    const capability = {poll: jest.fn().mockReturnValueOnce(pending).mockResolvedValue({rivals: []}),
      disconnect: jest.fn(async () => undefined)};
    /** One Reddit session whose pending poll must not outlive a revocation. */
    const presence = new RedditPollingPresence(capability, {sessionId: "session_123456789", onRivals,
      visibility: () => visibility});
    /** Starts the visible poll before changing host state. */
    const start = presence.setEnabled(true);
    await Promise.resolve();
    visibility = change === "hidden" ? "hidden" : "visible";
    /** Revocation waits for the earlier server mutation but clears UI immediately. */
    const revoke = change === "opt-out" ? presence.setEnabled(false) : change === "hidden" ? presence.visibilityChanged() : presence.stop();
    expect(onRivals).toHaveBeenLastCalledWith([]);
    expect(capability.poll).toHaveBeenCalledTimes(1);
    expect(capability.disconnect).not.toHaveBeenCalled();
    finish({rivals: [{userId: "old-rival", state: "playing"}]});
    await Promise.all([start, revoke]);
    expect(onRivals.mock.calls).toEqual([[[]]]);
    if (change === "opt-out") expect(capability.poll).toHaveBeenLastCalledWith({sessionId: "session_123456789", state: "online", enabled: false});
    else expect(capability.disconnect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(REDDIT_HUB_POLL_MS * 2);
    expect(capability.poll).toHaveBeenCalledTimes(change === "opt-out" ? 2 : 1);
  });

  it("finishes a pending opt-out before applying a newer opt-in", async () => {
    /** Releases the old opt-out write after the player has already opted in again. */
    let finish!: (result: EmptyRivalResult) => void;
    /** Holds revocation so network writes cannot complete out of order. */
    const pending = new Promise<EmptyRivalResult>(resolve => {finish = resolve;});
    /** Provider records every ordered lease update. */
    const capability = {poll: jest.fn().mockResolvedValueOnce({rivals: []}).mockReturnValueOnce(pending).mockResolvedValue({rivals: []}),
      disconnect: jest.fn(async () => undefined)};
    /** Session whose latest consent must remain authoritative. */
    const presence = new RedditPollingPresence(capability, {sessionId: "session_123456789", visibility: () => "visible"});
    await presence.setEnabled(true);
    /** Starts a slow opt-out before the player reverses their choice. */
    const disable = presence.setEnabled(false);
    await Promise.resolve();
    /** Latest opt-in must await the old disabling mutation. */
    const enable = presence.setEnabled(true);
    expect(capability.poll).toHaveBeenCalledTimes(2);
    finish({rivals: []});
    await Promise.all([disable, enable]);
    expect(capability.poll.mock.calls.map(([input]) => input.enabled)).toEqual([true, false, true]);
    await presence.stop();
  });
});
