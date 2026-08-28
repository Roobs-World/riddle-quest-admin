import {REDDIT_HUB_POLL_MS, REDDIT_RACE_POLL_MS, RedditPollingPresence} from "../RedditPollingPresence";
import type {PresenceCapability} from "../../platform/types";

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
});
