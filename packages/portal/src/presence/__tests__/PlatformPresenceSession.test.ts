import {PlatformPresenceSession, aggregatePresence, type PresenceTransport} from "../PlatformPresenceSession";

/** Provides connection behavior. */
const connection = (sessionId: string, state: "online" | "playing" | "racing") => ({
  sessionId,
  platform: "facebook" as const,
  state,
  updatedAtMs: 1,
});

describe("platform presence session", () => {
  it("aggregates multiple tabs/devices by active-state priority", () => {
    expect(aggregatePresence([])).toBe("offline");
    expect(aggregatePresence([connection("idle", "online"), connection("game", "playing")])).toBe("playing");
    expect(aggregatePresence([connection("game", "playing"), connection("race", "racing")])).toBe("racing");
  });

  it("does nothing until opt-in and removes the connection on opt-out", async () => {
    /** Provides transport behavior. */
    const transport = createTransport();
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(transport.port, {sessionId: "session-1", platform: "jest"}, () => 10);
    await session.start(false);
    expect(transport.port.register).not.toHaveBeenCalled();
    await session.start(true);
    expect(transport.port.armDisconnectRemoval).toHaveBeenCalledWith("session-1");
    expect(transport.port.register).toHaveBeenCalledWith({
      sessionId: "session-1",
      platform: "jest",
      state: "online",
      updatedAtMs: 10,
    });
    await session.stop();
    expect(transport.unsubscribe).toHaveBeenCalledTimes(1);
    expect(transport.port.remove).toHaveBeenCalledWith("session-1");
  });

  it("updates state and restores the latest state after a reconnect", async () => {
    /** Provides now behavior. */
    let now = 10;
    /** Provides transport behavior. */
    const transport = createTransport();
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(
      transport.port,
      {sessionId: "session-1", platform: "facebook"},
      () => ++now,
    );
    await session.start(true);
    await session.setState("racing");
    expect(transport.port.update).toHaveBeenCalledWith("session-1", "racing", 12);
    await transport.reconnect?.();
    expect(transport.port.register).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      platform: "facebook",
      state: "racing",
      updatedAtMs: 13,
    });
  });

  it("is idempotent across duplicate starts and stops", async () => {
    /** Provides transport behavior. */
    const transport = createTransport();
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(transport.port, {sessionId: "session-1", platform: "jest"});
    await session.start(true);
    await session.start(true);
    await session.stop();
    await session.stop();
    expect(transport.port.register).toHaveBeenCalledTimes(1);
    expect(transport.port.remove).toHaveBeenCalledTimes(1);
  });

  it("rolls back a failed initial registration so a later resume can retry", async () => {
    /** Provides transport behavior. */
    const transport = createTransport();
    transport.port.register.mockRejectedValueOnce(new Error("rtdb-unavailable")).mockResolvedValueOnce(undefined);
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(
      transport.port,
      {sessionId: "session-1", platform: "facebook"},
      () => 10,
    );

    await expect(session.start(true)).rejects.toThrow("rtdb-unavailable");
    expect(transport.unsubscribe).toHaveBeenCalledTimes(1);
    await expect(session.start(true)).resolves.toBeUndefined();
    expect(transport.port.armDisconnectRemoval).toHaveBeenCalledTimes(2);
    expect(transport.port.register).toHaveBeenCalledTimes(2);
    await session.stop();
    expect(transport.port.remove).toHaveBeenCalledWith("session-1");
  });

  it("deduplicates the immediate connected callback with the explicit initial registration", async () => {
    /** Provides transport behavior. */
    const transport = createTransport();
    transport.port.onReconnect.mockImplementation((callback) => {
      transport.reconnect = callback;
      void callback();
      return transport.unsubscribe;
    });
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(
      transport.port,
      {sessionId: "session-1", platform: "facebook"},
      () => 10,
    );

    await session.start(true);
    expect(transport.port.armDisconnectRemoval).toHaveBeenCalledTimes(1);
    expect(transport.port.register).toHaveBeenCalledTimes(1);
  });

  it("cannot write a late registration after opt-out while disconnect arming is in flight", async () => {
    /** Provides transport behavior. */
    const transport = createTransport();
    /** Provides release arm behavior. */
    let releaseArm!: () => void;
    transport.port.armDisconnectRemoval.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseArm = resolve;
        }),
    );
    /** Provides session behavior. */
    const session = new PlatformPresenceSession(
      transport.port,
      {sessionId: "session-1", platform: "facebook"},
      () => 10,
    );

    /** Starts ing. */
    const starting = session.start(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    /** Stops ping. */
    const stopping = session.stop();
    releaseArm();
    await starting;
    await stopping;
    expect(transport.port.register).not.toHaveBeenCalled();
    expect(transport.port.remove).toHaveBeenCalledTimes(1);
  });
});

/** Creates transport. */
function createTransport(): {
  /** Stores port. */
  port: jest.Mocked<PresenceTransport>;
  /** Stores unsubscribe. */
  unsubscribe: jest.Mock;
  /** Stores reconnect. */
  reconnect?: () => void | Promise<void>;
} {
  /** Provides result behavior. */
  const result: ReturnType<typeof createTransport> = {
    unsubscribe: jest.fn(),
    port: {} as jest.Mocked<PresenceTransport>,
  };
  result.port = {
    register: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    armDisconnectRemoval: jest.fn().mockResolvedValue(undefined),
    onReconnect: jest.fn((callback) => {
      result.reconnect = callback;
      return result.unsubscribe;
    }),
  };
  return result;
}
