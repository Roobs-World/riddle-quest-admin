import {describe, expect, it, jest} from "@jest/globals";
import type {PlatformPreferences, PlatformStorage, PlayerData} from "../types";
import {PlayerProjectionPersistence} from "../PlayerProjectionPersistence";

/** Complete in-memory storage adapter with independently replaceable failure paths. */
const createStorage = (overrides: Partial<PlatformStorage> = {}): PlatformStorage => ({
  readPreferences: async () => ({}),
  writePreferences: async () => undefined,
  readPlayerData: async () => null,
  writePlayerData: async () => undefined,
  clear: async () => undefined,
  flush: async () => undefined,
  ...overrides,
});

describe("player projection persistence", () => {
  it("preserves overlapping preference changes and returns each durable projection", async () => {
    /** Storage adapter records writes and controls acknowledgement failures. */
    const write = jest.fn<(value: PlatformPreferences) => Promise<void>>().mockResolvedValue(undefined);
    /** Shared persistence owner accepts changes through its public interface. */
    const persistence = new PlayerProjectionPersistence(createStorage({writePreferences: write}), null, {muted: false});

    /** Each caller receives its own durably acknowledged projection. */
    const results = await Promise.all([
      persistence.updatePreferences({muted: true}),
      persistence.updatePreferences({presenceEnabled: true}),
      persistence.updatePreferences({highContrast: true}),
    ]);

    expect(results).toEqual([
      {muted: true},
      {muted: true, presenceEnabled: true},
      {muted: true, presenceEnabled: true, highContrast: true},
    ]);
    expect(write.mock.calls.at(-1)?.[0]).toEqual(results[2]);
  });

  it("reports a failed write while allowing later updates to persist all accepted changes", async () => {
    /** Storage adapter records writes and controls acknowledgement failures. */
    const write = jest.fn<(value: PlatformPreferences) => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary-storage-failure"))
      .mockResolvedValue(undefined);
    /** Shared persistence owner accepts changes through its public interface. */
    const persistence = new PlayerProjectionPersistence(createStorage({writePreferences: write}), null);
    /** First accepted change reports its adapter failure. */
    const failed = persistence.updatePreferences({muted: true});
    /** Later accepted change retries the complete desired preferences. */
    const recovered = persistence.updatePreferences({presenceEnabled: true});

    await expect(failed).rejects.toThrow("temporary-storage-failure");
    await expect(recovered).resolves.toEqual({muted: true, presenceEnabled: true});
    expect(write).toHaveBeenLastCalledWith({muted: true, presenceEnabled: true});
  });

  it("retries failed projections when draining for account deletion and reports persistent failure", async () => {
    /** Storage adapter records writes and controls acknowledgement failures. */
    const write = jest.fn<(value: PlayerData) => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary-storage-failure"))
      .mockResolvedValue(undefined);
    /** Adapter observes deletion after accepted writes settle. */
    const clear = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    /** Shared persistence owner accepts changes through its public interface. */
    const persistence = new PlayerProjectionPersistence(createStorage({writePlayerData: write, clear}), null);

    await expect(persistence.update({activeGame: null})).rejects.toThrow("temporary-storage-failure");
    await persistence.closeAndFlush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toEqual(write.mock.calls[0][0]);
    await persistence.clear();
    expect(clear).toHaveBeenCalledTimes(1);

    /** Persistent storage failures must remain visible to deletion callers. */
    const blocked = new PlayerProjectionPersistence(createStorage({
      writePreferences: async () => {throw new Error("still-unavailable");},
    }), null);
    await expect(blocked.updatePreferences({muted: true})).rejects.toThrow("still-unavailable");
    await expect(blocked.closeAndFlush()).rejects.toThrow("still-unavailable");
  });

  it("retains a failed flush for retry and prevents an older projection from returning after clear", async () => {
    /** Storage adapter records writes and controls acknowledgement failures. */
    const write = jest.fn<(value: PlatformPreferences) => Promise<void>>().mockResolvedValue(undefined);
    /** Adapter simulates an uncertain durability acknowledgement. */
    const flush = jest.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("uncertain-durability"))
      .mockResolvedValue(undefined);
    /** Shared persistence owner accepts changes through its public interface. */
    const persistence = new PlayerProjectionPersistence(createStorage({writePreferences: write, flush}), null);
    await expect(persistence.updatePreferences({muted: true})).rejects.toThrow("uncertain-durability");
    await persistence.flush();
    expect(write).toHaveBeenCalledTimes(2);

    await Promise.all([persistence.clear(), persistence.updatePreferences({presenceEnabled: true})]);
    expect(write).toHaveBeenLastCalledWith({presenceEnabled: true});
  });

  it("serializes merged versioned projections through the target storage adapter", async () => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Provides storage behavior. */
    const storage = {
      writePlayerData: jest.fn(async (value: PlayerData) => events.push(`write:${value.profile?.coins}`)),
      flush: jest.fn(async () => events.push("flush")),
    } as unknown as PlatformStorage;
    /** Provides persistence behavior. */
    const persistence = new PlayerProjectionPersistence(storage, {
      schemaVersion: 1,
      updatedAt: 1,
      profile: {username: "Ada", coins: 2, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1},
    });

    await persistence.update({profile: {username: "Ada", coins: 7, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});

    expect(events).toEqual(["write:7", "flush"]);
    expect(storage.writePlayerData).toHaveBeenCalledWith(
      expect.objectContaining({schemaVersion: 1, profile: expect.objectContaining({coins: 7})}),
    );
  });

  it("owns preference merge, flush, and deletion ordering", async () => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Provides storage behavior. */
    const storage = {
      writePreferences: jest.fn(async () => events.push("preferences")),
      flush: jest.fn(async () => events.push("flush")),
      clear: jest.fn(async () => events.push("clear")),
    } as unknown as PlatformStorage;
    /** Provides persistence behavior. */
    const persistence = new PlayerProjectionPersistence(storage, null, {muted: false});

    await persistence.updatePreferences({presenceEnabled: true});
    await persistence.closeAndFlush();
    await expect(persistence.updatePreferences({muted: true})).rejects.toThrow("player-projection-persistence-closed");
    await persistence.clear();

    expect(events).toEqual(["preferences", "flush", "flush", "clear"]);
  });
});
