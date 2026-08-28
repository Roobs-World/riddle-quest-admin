import {settleFacebookPause, settleFacebookPresenceResume, type FacebookPauseFailure} from "../settleFacebookPause";

describe("settleFacebookPause", () => {
  it("attempts and awaits storage and presence cleanup", async () => {
    /** Provides calls behavior. */
    const calls: string[] = [];
    await settleFacebookPause({
      flushStorage: async () => {
        calls.push("flush");
      },
      stopPresence: async () => {
        calls.push("presence");
      },
      reportFailure: jest.fn(),
    });
    expect(calls.sort()).toEqual(["flush", "presence"]);
  });

  it("contains independent failures without skipping the other operation", async () => {
    /** Provides failures behavior. */
    const failures: FacebookPauseFailure[] = [];
    /** Provides presence attempted behavior. */
    let presenceAttempted = false;
    await expect(
      settleFacebookPause({
        flushStorage: async () => {
          throw new Error("flush-failed");
        },
        stopPresence: async () => {
          presenceAttempted = true;
          throw new Error("presence-failed");
        },
        reportFailure: (failure) => failures.push(failure),
      }),
    ).resolves.toBeUndefined();
    expect(presenceAttempted).toBe(true);
    expect(failures.map(({operation}) => operation)).toEqual(["flush_storage", "stop_presence"]);
    expect(failures.map(({error}) => (error as Error).message)).toEqual(["flush-failed", "presence-failed"]);
  });

  it("supports sessions where presence is unavailable", async () => {
    /** Provides report failure behavior. */
    const reportFailure = jest.fn();
    await settleFacebookPause({flushStorage: async () => undefined, reportFailure});
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("restores opted-in presence and contains reconnect failures", async () => {
    /** Provides disabled start behavior. */
    const disabledStart = jest.fn(async () => undefined);
    await settleFacebookPresenceResume({
      enabled: false,
      startPresence: disabledStart,
      reportFailure: jest.fn(),
    });
    expect(disabledStart).not.toHaveBeenCalled();

    /** Provides error behavior. */
    const error = new Error("reconnect-failed");
    /** Provides report failure behavior. */
    const reportFailure = jest.fn();
    await expect(
      settleFacebookPresenceResume({
        enabled: true,
        startPresence: async () => {
          throw error;
        },
        reportFailure,
      }),
    ).resolves.toBeUndefined();
    expect(reportFailure).toHaveBeenCalledWith(error);
  });
});
