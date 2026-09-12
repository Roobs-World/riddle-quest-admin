import {describe, expect, it, jest} from "@jest/globals";
import type {PlatformStorage, PlayerData} from "../types";
import {PlayerProjectionPersistence} from "../PlayerProjectionPersistence";

describe("player projection persistence", () => {
  it("serializes merged versioned projections through the target storage adapter", async () => {
    const events: string[] = [];
    const storage = {
      writePlayerData: jest.fn(async (value: PlayerData) => events.push(`write:${value.profile?.coins}`)),
      flush: jest.fn(async () => events.push("flush")),
    } as unknown as PlatformStorage;
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
    const events: string[] = [];
    const storage = {
      writePreferences: jest.fn(async () => events.push("preferences")),
      flush: jest.fn(async () => events.push("flush")),
      clear: jest.fn(async () => events.push("clear")),
    } as unknown as PlatformStorage;
    const persistence = new PlayerProjectionPersistence(storage, null, {muted: false});

    await persistence.updatePreferences({presenceEnabled: true});
    await persistence.closeAndFlush();
    await expect(persistence.updatePreferences({muted: true})).rejects.toThrow("player-projection-persistence-closed");
    await persistence.clear();

    expect(events).toEqual(["preferences", "flush", "flush", "clear"]);
  });
});
