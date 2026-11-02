import {ACHIEVEMENT_MILESTONES} from "@riddle-quest/core/game";
import {findNewYouTubeAchievements, YOUTUBE_ACHIEVEMENTS} from "../../playable/achievements";
import {createEmptyYouTubeSave, parseYouTubeSave, serializeYouTubeSave} from "../../playable/save";
import {LocalSoloAuthority} from "../../playable/LocalSoloAuthority";
import {YouTubeSaveGate} from "../../playable/YouTubeSaveGate";
import type {YouTubeContent} from "../../playable/types";

/** Non-first-try solve context keeps one-off badges out of boundary assertions. */
const context = {mode: "classic" as const, isCorrect: true, attempts: 2, gameOver: true};

describe("solo milestone parity and durability", () => {
  it.each(ACHIEVEMENT_MILESTONES)("unlocks $id at the same counter boundary and never twice", ({id, stat, threshold}) => {
    /** Fresh local counters used to test the unlock boundary. */
    const progress = createEmptyYouTubeSave("test").progression;
    /** Local save field corresponding to the shared server statistic. */
    const key = stat === "highestLevelClassic" ? "highestClassicLevel" : stat === "bestStreak" ? "bestDailyStreak" : stat;
    progress[key] = threshold - 1;
    expect(findNewYouTubeAchievements(progress, context)).not.toContain(id);
    progress[key] = threshold;
    expect(findNewYouTubeAchievements(progress, context)).toContain(id);
    progress.unlockedAchievementIds = [id];
    progress[key] = threshold + 1;
    expect(findNewYouTubeAchievements(progress, context)).not.toContain(id);
  });

  it("persists a full solo catalog within the save contract", () => {
    /** Save envelope containing every supported solo achievement. */
    const save = createEmptyYouTubeSave("test");
    save.progression.unlockedAchievementIds = YOUTUBE_ACHIEVEMENTS.map(({id}) => id);
    /** Validated save restored from serialized achievement progress. */
    const parsed = parseYouTubeSave(serializeYouTubeSave(save), "test");
    expect(parsed.kind).toBe("valid");
    if (parsed.kind === "valid") expect(parsed.save.progression.unlockedAchievementIds).toHaveLength(53);
  });

  it("grants new win/play milestones, saves the reward, and preserves it on reload", async () => {
    /** Deterministic riddle used to earn milestone rewards through gameplay. */
    const riddle = {canonicalId: "riddle:rome", text: "Ancient city?", answer: "rome", categoryId: "history",
      difficultyBand: "easy" as const, contentFingerprint: "0123456789abcdef"};
    /** Self-contained test content with a Classic and Daily schedule. */
    const content: YouTubeContent = {contentVersion: "test", locale: "en", classicOrder: [riddle.canonicalId],
      daily: {scheduleVersion: 1, segments: [{startsOn: "2026-01-01", canonicalIds: [riddle.canonicalId]}]},
      riddles: new Map([[riddle.canonicalId, riddle]])};
    /** Legacy progression placed just below both new ten-game milestones. */
    const loaded = createEmptyYouTubeSave("test");
    Object.assign(loaded.progression, {totalWins: 9, gamesPlayed: 9, totalGuesses: 18, totalGuessesInWins: 18});
    loaded.progression.unlockedAchievementIds = ["first_win", "wins_5", "perfect_guess", "classic_perfect", "win_rate_80", "efficient_10"];
    /** Records exact persisted game transitions for reload verification. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Local game authority that awards and persists achievements. */
    const authority = await LocalSoloAuthority.restore(loaded, content, new YouTubeSaveGate({saveData}));
    await authority.start("classic");
    authority.setInput(["r", "o", "m", "e"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({
      kind: "win", newlyUnlockedAchievementIds: ["wins_10", "games_10"], coinsEarned: 55,
    });
    /** Last committed save after the successful milestone completion. */
    const persisted = parseYouTubeSave(saveData.mock.calls.at(-1)![0], "test");
    expect(persisted.kind).toBe("valid");
    if (persisted.kind !== "valid") throw new Error("milestone-save-invalid");
    /** Restored authority used to verify durable, nonduplicated unlocks. */
    const reloaded = await LocalSoloAuthority.restore(persisted.save, content, new YouTubeSaveGate({saveData}));
    expect(reloaded.getSnapshot().save.progression.coins).toBe(355);
    expect(findNewYouTubeAchievements(reloaded.getSnapshot().save.progression, context)).toEqual([]);
  });
});
