import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {PlayerProjectionPersistence} from "../PlayerProjectionPersistence";
import type {PlatformStorage, PlayerData} from "../../../../platform/contracts/capabilities";

/** Actual persistence adapter fails once before acknowledging the next projection. */
const fixture = () => {
  /** Records actual adapter attempts and controls write acknowledgement. */
  const write = jest.fn<(value: PlayerData) => Promise<void>>()
    .mockRejectedValueOnce(new Error("injected-provider-save-failure"))
    .mockResolvedValue(undefined);
  /** A healthy consumer still receives lifecycle delivery. */
  const storage: PlatformStorage = {readPreferences: async () => ({}), writePreferences: async () => undefined,
    readPlayerData: async () => null, writePlayerData: write, flush: async () => undefined, clear: async () => undefined};
  /** One initialized persistence instance owns accepted projections. */
  const owner = new PlayerProjectionPersistence(storage, null);
  return {owner, write};
};

afterEach(() => jest.useRealTimers());

describe("provider projection save recovery", () => {
  it("recovers a rejected clear without requiring another accepted update", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    owner.attachRecovery(() => true);
    await expect(owner.update({activeGame: null})).rejects.toThrow("injected-provider-save-failure");
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({activeGame: null}));
  });

  it("retains the rejected clear for a deliberate flush", async () => {
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    await expect(owner.update({activeGame: null})).rejects.toThrow("injected-provider-save-failure");
    await owner.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({activeGame: null}));
  });

  it("bounds persistent failure and allows a fresh manual episode", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    write.mockRejectedValue(new Error("offline"));
    owner.attachRecovery(() => true);
    await owner.update({activeGame: null}).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(4);
    expect(owner.recovery.getSnapshot()).toBe("unsaved");
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(4);
    write.mockResolvedValue(undefined);
    owner.recovery.wake();
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(5);
    expect(owner.recovery.getSnapshot()).toBe("quiet");
  });

  it("waits offline and cancels retired automatic work", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    /** Browser availability changes independently of accepted input. */
    let online = false;
    owner.attachRecovery(() => online);
    await owner.update({activeGame: null}).catch(() => undefined);
    expect(owner.recovery.getSnapshot()).toBe("unsaved");
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(1);
    online = true;
    owner.recovery.wake();
    owner.detachRecovery();
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(owner.recovery.getSnapshot()).toBe("quiet");
  });

  it("does not duplicate a healthy latest save held ahead of its retry", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    owner.attachRecovery(() => true);
    await owner.update({activeGame: null}).catch(() => undefined);
    /** Releases the held healthy storage acknowledgement. */
    let release!: () => void;
    write.mockImplementationOnce(() => new Promise<void>(resolve => {release = resolve;}));
    /** Newest accepted write stays in flight ahead of automatic retry. */
    const healthy = owner.update({activeGame: null});
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    release();
    await healthy;
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    expect(owner.recovery.getSnapshot()).toBe("quiet");
  });

  it("keeps the notice until newer queued state is acknowledged", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    owner.attachRecovery(() => false);
    await owner.update({activeGame: null}).catch(() => undefined);
    /** Independent acknowledgements expose notice ordering. */
    let releaseOlder!: () => void, releaseLatest!: () => void;
    write.mockImplementationOnce(() => new Promise<void>(resolve => {releaseOlder = resolve;}));
    /** An older accepted projection enters the adapter first. */
    const older = owner.update({activeGame: null});
    await jest.advanceTimersByTimeAsync(0);
    write.mockImplementationOnce(() => new Promise<void>(resolve => {releaseLatest = resolve;}));
    /** A newer authority cache update must also be acknowledged. */
    const latest = owner.update({profile: {username: "Latest authority", coins: 30, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    releaseOlder();
    await older;
    await jest.advanceTimersByTimeAsync(0);
    expect(owner.recovery.getSnapshot()).toBe("unsaved");
    releaseLatest();
    await latest;
    expect(owner.recovery.getSnapshot()).toBe("quiet");
  });

  it("rechecks the account gate after waiting for a retry lock", async () => {
    jest.useFakeTimers();
    /** Controlled adapter records whether a retired retry enters storage. */
    const {write} = fixture();
    /** Deferred target ownership lock can outlive the originating view. */
    let retryLock!: () => void, open = true, calls = 0;
    /** One initialized persistence instance owns accepted projections. */
    const owner = new PlayerProjectionPersistence({readPreferences: async () => ({}), writePreferences: async () => undefined,
      readPlayerData: async () => null, writePlayerData: write, flush: async () => undefined, clear: async () => undefined}, null, {}, {
      run: async operation => {
        if (++calls === 2) await new Promise<void>(resolve => {retryLock = resolve;});
        if (!open) throw new Error("account-retired");
        return operation();
      },
    });
    owner.attachRecovery(() => open);
    await owner.update({activeGame: null}).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(1000);
    open = false;
    retryLock();
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not revive queued retries when the same owner attaches to a new view", async () => {
    jest.useFakeTimers();
    /** Controlled adapter records whether a retired retry enters storage. */
    const {write} = fixture();
    /** Deferred target ownership lock can outlive the originating view. */
    let retryLock!: () => void, calls = 0;
    /** One initialized persistence instance owns accepted projections. */
    const owner = new PlayerProjectionPersistence({readPreferences: async () => ({}), writePreferences: async () => undefined,
      readPlayerData: async () => null, writePlayerData: write, flush: async () => undefined, clear: async () => undefined}, null, {}, {
      run: async operation => {
        if (++calls === 2) await new Promise<void>(resolve => {retryLock = resolve;});
        return operation();
      },
    });
    owner.attachRecovery(() => true);
    await owner.update({activeGame: null}).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(1000);
    owner.detachRecovery();
    owner.attachRecovery(() => true);
    retryLock();
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(owner.recovery.getSnapshot()).toBe("quiet");
  });

  it("recovers merged preferences independently of a healthy player projection", async () => {
    jest.useFakeTimers();
    /** Controlled adapter records whether a retired retry enters storage. */
    const {write} = fixture();
    write.mockReset().mockResolvedValue(undefined);
    /** Preference acknowledgement fails independently of the player projection. */
    const preferences = jest.fn<(value: Record<string, unknown>) => Promise<void>>()
      .mockRejectedValueOnce(new Error("preferences-unavailable")).mockResolvedValue(undefined);
    /** One initialized persistence instance owns accepted projections. */
    const owner = new PlayerProjectionPersistence({readPreferences: async () => ({}), writePreferences: preferences,
      readPlayerData: async () => null, writePlayerData: write, flush: async () => undefined, clear: async () => undefined}, null);
    owner.attachRecovery(() => true);
    await owner.updatePreferences({muted: true}).catch(() => undefined);
    await owner.update({activeGame: null});
    await owner.updatePreferences({highContrast: true});
    expect(preferences).toHaveBeenLastCalledWith({muted: true, highContrast: true});
    expect(owner.recovery.getSnapshot()).toBe("quiet");
    await jest.advanceTimersByTimeAsync(15000);
    expect(preferences).toHaveBeenCalledTimes(2);
  });

  it("retires recovery before deletion drains and clears accepted dirty state", async () => {
    jest.useFakeTimers();
    /** Controlled provider boundary and queue under the current scenario. */
    const {owner, write} = fixture();
    owner.attachRecovery(() => true);
    await owner.update({activeGame: null}).catch(() => undefined);
    await owner.closeAndFlush();
    await owner.clear();
    owner.recovery.wake();
    await jest.advanceTimersByTimeAsync(15000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(owner.recovery.getSnapshot()).toBe("quiet");
    await expect(owner.update({activeGame: null})).rejects.toThrow("player-projection-persistence-closed");
  });


  it("does not begin a preference retry after its preceding projection outlives the view", async () => {
    jest.useFakeTimers();
    /** Player and preference failures belong to the same accepted recovery episode. */
    const {write} = fixture();
    /** Projection acknowledgement remains held across view retirement. */
    let release!: () => void;
    write.mockReset().mockImplementationOnce(async () => {throw new Error("projection-failed");})
      .mockImplementationOnce(() => new Promise<void>(resolve => {release = resolve;}));
    /** Preference mutation must not begin from the retired asynchronous continuation. */
    const preferences = jest.fn<(value: Record<string, unknown>) => Promise<void>>()
      .mockRejectedValueOnce(new Error("preferences-failed")).mockResolvedValue(undefined);
    /** Actual shared queue combines both dirty fields for automatic recovery. */
    const owner = new PlayerProjectionPersistence({readPreferences: async () => ({}), writePreferences: preferences,
      readPlayerData: async () => null, writePlayerData: write, flush: async () => undefined, clear: async () => undefined}, null);
    owner.attachRecovery(() => true);
    await owner.updatePreferences({muted: true}).catch(() => undefined);
    await owner.update({activeGame: null}).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(1000);
    owner.detachRecovery();
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(preferences).toHaveBeenCalledTimes(1);
    owner.attachRecovery(() => true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(preferences).toHaveBeenCalledTimes(2);
  });

});
