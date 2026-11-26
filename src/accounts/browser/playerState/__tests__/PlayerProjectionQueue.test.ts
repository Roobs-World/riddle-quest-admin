import {describe, expect, it, jest} from "@jest/globals";
import {PlayerProjectionPersistence} from "../PlayerProjectionPersistence";
import type {PlatformStorage, PlayerData} from "../../../../platform/contracts/capabilities";
import {createSavedGame} from "../../../../gameplay/session/checkpoints/GameSessionCheckpoints";
import {createInitialGameSession, gameSessionReducer} from "../../../../gameplay/session/gameSession";

/** Controlled adapter acknowledgement exposes waiting and in-flight work. */
const deferred = () => {
  /** Resolves the adapter acknowledgement. */
  let resolve: () => void = () => undefined;
  /** Pending adapter acknowledgement. */
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
};
/** Real reducer projection avoids making storage tests depend on incomplete checkpoint fixtures. */
const draft = (text: string) => {
  /** Authority-issued active session. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    riddleId: "queue-question", sessionToken: "00000000-0000-4000-8000-000000000001",
    text: "Clue", answerLength: 5, gameMode: "classic", attemptsUsed: 0,
    hasUsedContinue: false, awaitingContinue: false,
  }});
  for (const letter of text) state = gameSessionReducer(state, {type: "typeLetter", letter});
  return createSavedGame(state);
};
/** Cached authority profile supplied independently of answer progress. */
const profile = (coins: number) => ({username: "Ada", coins, level: 1, xp: 0,
  winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1});
/** Complete target storage adapter with independently held or failing operations. */
const storage = (overrides: Partial<PlatformStorage>): PlatformStorage => ({
  readPreferences: async () => ({}), writePreferences: async () => undefined,
  readPlayerData: async () => null, writePlayerData: async () => undefined,
  clear: async () => undefined, flush: async () => undefined, ...overrides,
});

describe("player projection queue", () => {
  it("merges waiting checkpoints and independent profile fields without writing obsolete snapshots", async () => {
    /** Adapter records the latest merged projection. */
    const write = jest.fn<(value: PlayerData) => Promise<void>>().mockResolvedValue(undefined);
    /** One persistence owner controls the queue. */
    const owner = new PlayerProjectionPersistence(storage({writePlayerData: write}), null);
    await Promise.all([
      owner.update({activeGame: draft("P")}), owner.update({profile: profile(200)}),
      owner.update({activeGame: draft("PIAN")}),
    ]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({
      schemaVersion: 1, profile: profile(200), activeGame: expect.objectContaining({currentLetters: ["P", "I", "A", "N", ""]}),
    }));
  });

  it("keeps an in-flight snapshot fixed and reduces 100 waiting edits to the newest write", async () => {
    /** First write occupies the target adapter. */
    const held = deferred(), entered = deferred();
    /** Adapter records every actual write. */
    const write = jest.fn<(value: PlayerData) => Promise<void>>()
      .mockImplementationOnce(async () => {entered.resolve(); await held.promise;})
      .mockResolvedValue(undefined);
    /** One persistence owner controls the queue. */
    const owner = new PlayerProjectionPersistence(storage({writePlayerData: write}), null);
    /** In-flight checkpoint is immutable while later edits arrive. */
    const first = owner.update({activeGame: draft("P")});
    await entered.promise;
    /** Latest accepted state must remain unacknowledged while storage is held. */
    let acknowledged = false;
    /** Rapid edits produce one waiting projection rather than 100 writes. */
    const waiting = Array.from({length: 100}, (_, index) => owner.update({activeGame: draft(index === 99 ? "PIAN" : "PI")}));
    /** A profile update joins the pending draft without discarding it. */
    const latest = owner.update({profile: profile(300)}).then(() => {acknowledged = true;});
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0].activeGame?.currentLetters.join("")).toBe("P");
    held.resolve();
    await Promise.all([first, ...waiting, latest]);
    expect(acknowledged).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toMatchObject({profile: profile(300), activeGame: {currentLetters: ["P", "I", "A", "N", ""]}});
  });

  it("does not acknowledge any grouped update before the target flush succeeds", async () => {
    /** Flush, rather than write completion, acknowledges durability. */
    const held = deferred(), entered = deferred();
    /** Adapter writes complete promptly. */
    const write = jest.fn<(value: PlayerData) => Promise<void>>().mockResolvedValue(undefined);
    /** First flush waits for a provider acknowledgement. */
    const flush = jest.fn<() => Promise<void>>()
      .mockImplementationOnce(async () => {entered.resolve(); await held.promise;})
      .mockResolvedValue(undefined);
    /** One persistence owner controls the queue. */
    const owner = new PlayerProjectionPersistence(storage({writePlayerData: write, flush}), null);
    /** First caller tracks its acknowledgement. */
    let firstDone = false, latestDone = false;
    /** In-flight checkpoint awaits flush. */
    const first = owner.update({activeGame: draft("P")}).then(() => {firstDone = true;});
    await entered.promise;
    /** Both waiting changes share acknowledgement of the complete merged projection. */
    const second = owner.update({activeGame: draft("PI")});
    /** Latest waiting update shares the grouped durability acknowledgement. */
    const latest = owner.update({activeGame: draft("PIAN")}).then(() => {latestDone = true;});
    await Promise.resolve();
    expect([firstDone, latestDone, write.mock.calls.length]).toEqual([false, false, 1]);
    held.resolve();
    await Promise.all([first, second, latest]);
    expect([firstDone, latestDone, write.mock.calls.length, flush.mock.calls.length]).toEqual([true, true, 2, 2]);
  });

  it("preserves flush, preference and clear positions between pending player updates", async () => {
    /** Adapter records externally observable ordering. */
    const events: string[] = [], written: PlayerData[] = [];
    /** One persistence owner controls all target storage work. */
    const owner = new PlayerProjectionPersistence(storage({
      writePlayerData: async value => {written.push(value); events.push(`write:${value.activeGame?.currentLetters.join("")}`);},
      writePreferences: async () => {events.push("preferences");},
      flush: async () => {events.push("flush");}, clear: async () => {events.push("clear");},
    }), null);
    await Promise.all([
      owner.update({activeGame: draft("P"), profile: profile(50)}), owner.flush(),
      owner.update({activeGame: draft("PI")}), owner.updatePreferences({muted: true}),
      owner.update({activeGame: draft("PIA")}), owner.clear(), owner.update({activeGame: draft("PIAN")}),
    ]);
    expect(events).toEqual(["write:P", "flush", "flush", "write:PI", "flush", "preferences", "flush",
      "write:PIA", "flush", "clear", "write:PIAN", "flush"]);
    expect(written.at(-1)).not.toHaveProperty("profile");
  });

  it.each(["write", "flush"])("reports grouped %s failure to every caller and retains all merged fields for retry", async failure => {
    /** Adapter recovers after one temporary failure. */
    const write = jest.fn<(value: PlayerData) => Promise<void>>().mockResolvedValue(undefined);
    /** Flush may fail after the provider accepted a write. */
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    if (failure === "write") write.mockRejectedValueOnce(new Error("temporarily-unavailable"));
    else flush.mockRejectedValueOnce(new Error("temporarily-unavailable"));
    /** One persistence owner retains failed projections. */
    const owner = new PlayerProjectionPersistence(storage({writePlayerData: write, flush}), null);
    /** Both callers must observe the common durability failure. */
    const results = await Promise.allSettled([owner.update({activeGame: draft("PIAN")}), owner.update({profile: profile(250)})]);
    expect(results.map(value => value.status)).toEqual(["rejected", "rejected"]);
    await owner.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toEqual(write.mock.calls[0][0]);
    expect(write.mock.calls[1][0]).toMatchObject({profile: profile(250), activeGame: {currentLetters: ["P", "I", "A", "N", ""]}});
  });

  it("drains the latest accepted projection before deletion and rejects later updates", async () => {
    /** Adapter records deletion ordering. */
    const events: string[] = [];
    /** One persistence owner closes after accepted changes. */
    const owner = new PlayerProjectionPersistence(storage({
      writePlayerData: async value => {events.push(`write:${value.activeGame?.currentLetters.join("")}`);},
      flush: async () => {events.push("flush");}, clear: async () => {events.push("clear");},
    }), null);
    /** Earlier and newer queued drafts precede the close boundary. */
    const first = owner.update({activeGame: draft("P")});
    /** Latest pending draft replaces the earlier pending values. */
    const latest = owner.update({activeGame: draft("PIAN")});
    /** Closing immediately prevents any later accepted player mutation. */
    const closed = owner.closeAndFlush();
    await expect(owner.update({activeGame: draft("PIANO")})).rejects.toThrow("player-projection-persistence-closed");
    await Promise.all([first, latest, closed]);
    await owner.clear();
    expect(events).toEqual(["write:PIAN", "flush", "flush", "clear"]);
  });
});
