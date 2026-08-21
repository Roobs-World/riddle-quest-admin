import type {YouTubeContent, YouTubeRiddle, YouTubeSavedGuess, YouTubeSaveV1} from "../types";
import {
  LocalSoloAuthority,
  YouTubeAuthorityError,
  YouTubeAuthorityRestoreSaveError,
} from "../LocalSoloAuthority";
import {
  YOUTUBE_SAVE_BUDGET_BYTES,
  createEmptyYouTubeSave,
  parseYouTubeSave,
  serializeYouTubeSave,
} from "../save";
import {YouTubeSaveGate} from "../YouTubeSaveGate";

const riddles: YouTubeRiddle[] = [
  {canonicalId: "riddle:rome", text: "Ancient city?", answer: "rome", categoryId: "history", difficultyBand: "easy", contentFingerprint: "0123456789abcdef"},
  {canonicalId: "riddle:moon", text: "Night light?", answer: "moon", categoryId: "science", difficultyBand: "easy", contentFingerprint: "abcdef0123456789"},
];

const content: YouTubeContent = {
  contentVersion: "content-v1",
  locale: "en",
  classicOrder: riddles.map(({canonicalId}) => canonicalId),
  daily: {
    scheduleVersion: 1,
    segments: [{startsOn: "2026-01-01", canonicalIds: riddles.map(({canonicalId}) => canonicalId)}],
  },
  riddles: new Map(riddles.map((riddle) => [riddle.canonicalId, riddle])),
};

const createAuthority = async (
  saveData: (data: string) => Promise<void> = async () => undefined,
  loaded: YouTubeSaveV1 = createEmptyYouTubeSave(content.contentVersion),
  now = () => new Date("2026-01-01T12:00:00.000Z"),
) => LocalSoloAuthority.restore(loaded, content, new YouTubeSaveGate({saveData}), now);

const createNearBudgetSave = (combiningMarks: number): YouTubeSaveV1 => {
  const save = createEmptyYouTubeSave(content.contentVersion);
  const letter = `á${"\u0301".repeat(combiningMarks)}`;
  const guess: YouTubeSavedGuess = {
    letters: Array.from({length: 4}, () => letter),
    feedback: Array.from({length: 4}, () => "red" as const),
  };
  save.revision = 100;
  save.progression.totalGuesses = 5;
  save.progression.unlockedAchievementIds = Array.from(
    {length: 64},
    (_, index) => `${"a".repeat(195)}${index}`,
  );
  save.activeGame = {
    sessionRevision: 1,
    mode: "classic",
    riddleId: "riddle:rome",
    contentFingerprint: "0123456789abcdef",
    hintRevealedIndices: [],
    guesses: Array.from({length: 5}, () => guess),
    attemptsUsed: 5,
    hasUsedContinue: false,
    awaitingContinue: true,
  };
  save.operationReceipts = Array.from({length: 63}, (_, index) => ({
    id: `${"b".repeat(195)}${index}`,
    revision: index + 1,
  }));
  return save;
};

describe("LocalSoloAuthority", () => {
  it("does not save empty defaults and gates every material Classic transition", async () => {
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await createAuthority(saveData);
    expect(saveData).not.toHaveBeenCalled();

    await authority.start("classic");
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(authority.getSnapshot().save.activeGame?.riddleId).toBe("riddle:rome");
    await expect(authority.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});

    authority.setInput(["r", "o", "m", "e"], 3);
    const result = await authority.submitGuess();
    expect(result).toMatchObject({kind: "win", attempts: 1, coinsEarned: 150, xpEarned: 100});
    const snapshot = authority.getSnapshot();
    expect(snapshot.save.activeGame).toBeNull();
    expect(snapshot.save.progression).toMatchObject({coins: 450, xp: 100, level: 2, classicIndex: 1, totalWins: 1});
    expect(snapshot.save.progression.unlockedAchievementIds).toEqual(expect.arrayContaining([
      "first_win", "perfect_guess", "classic_perfect",
    ]));
    const persisted = saveData.mock.calls[1]?.[0] ?? "";
    expect(persisted).not.toContain('"answer"');
    expect(persisted).not.toContain("rome");
  });

  it("evaluates coin achievements after base and level-up coins but before the achievement bonus", async () => {
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.progression.coins = 930;
    loaded.progression.xp = 99;
    loaded.progression.level = 1;
    loaded.progression.unlockedAchievementIds = ["first_win", "perfect_guess", "classic_perfect"];
    const authority = await createAuthority(async () => undefined, loaded);

    await authority.start("classic");
    authority.setInput(["r", "o", "m", "e"], 3);
    const result = await authority.submitGuess();

    expect(result).toMatchObject({
      kind: "win",
      coinsEarned: 100,
      newlyUnlockedAchievementIds: ["coin_hoarder"],
    });
    expect(authority.getSnapshot().save.progression).toMatchObject({
      coins: 1_030,
      xp: 199,
      level: 2,
    });
  });

  it("retains an uncertain wrong-guess revision, freezes input, and retries exact bytes", async () => {
    const saveData = jest.fn<Promise<void>, [string]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const authority = await createAuthority(saveData);
    await authority.start("classic");
    authority.setInput(["n", "o", "p", "e"], 3);
    await expect(authority.submitGuess()).rejects.toThrow("uncertain");
    expect(authority.getSnapshot()).toMatchObject({saveBlocked: true});
    const exactFailedPayload = saveData.mock.calls[1]?.[0];

    const stagedLetters = authority.getSnapshot().displayLetters;
    authority.setInput(["r", "o", "m", "e"], 3);
    expect(authority.getSnapshot().displayLetters).toEqual(stagedLetters);
    await authority.retryPendingSave();
    expect(saveData.mock.calls[2]?.[0]).toBe(exactFailedPayload);
    authority.setInput(["r", "o", "m", "e"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "win"});
  });

  it("persists hint, continue, and terminal loss economy without allowing locked-letter edits", async () => {
    const authority = await createAuthority();
    await authority.start("classic");
    await expect(authority.requestHint()).resolves.toContain("hint_user");
    expect(authority.getSnapshot().save.progression.coins).toBe(275);
    const hinted = authority.getSnapshot().save.activeGame!;
    expect(authority.getSnapshot().displayLetters?.[hinted.hintRevealedIndices[0]]).toBe("r");
    authority.setInput(["x", "x", "x", "x"], 3);
    expect(authority.getSnapshot().displayLetters?.[hinted.hintRevealedIndices[0]]).toBe("r");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      authority.setInput(["r", "x", "x", "x"], 3);
      await authority.submitGuess();
    }
    expect(authority.getSnapshot().save.activeGame).toMatchObject({awaitingContinue: true, attemptsUsed: 5});
    await authority.buyContinue();
    expect(authority.getSnapshot().save.progression.coins).toBe(175);
    authority.setInput(["r", "x", "x", "x"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "loss", attempts: 6});
    expect(authority.getSnapshot().save).toMatchObject({activeGame: null, progression: {gamesPlayed: 1}});
  });

  it("reconstructs every hinted answer letter without serializing those letters", async () => {
    const persisted: string[] = [];
    const authority = await createAuthority(async (data) => { persisted.push(data); });
    await authority.start("classic");
    for (let index = 0; index < 4; index += 1) await authority.requestHint();

    const snapshot = authority.getSnapshot();
    expect(snapshot.displayLetters?.join("")).toBe("rome");
    expect(snapshot.save.activeGame).not.toHaveProperty("currentLetters");
    const latest = JSON.parse(persisted.at(-1) ?? "null") as {activeGame?: object};
    expect(latest.activeGame).not.toHaveProperty("currentLetters");
  });

  it("awards Daily once per UTC date and computes the current streak", async () => {
    const now = () => new Date("2026-01-01T23:59:59.000Z");
    const authority = await createAuthority(async () => undefined, createEmptyYouTubeSave(content.contentVersion), now);
    await authority.start("daily");
    authority.setInput(["r", "o", "m", "e"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "win", mode: "daily"});
    const progress = authority.getSnapshot().save.progression;
    expect(progress).toMatchObject({lastDailyCompletedDate: "2026-01-01", currentDailyStreak: 1, dailyPuzzlesCompleted: 1});
    authority.clearResult();
    await expect(authority.start("daily")).rejects.toMatchObject({code: "daily-already-complete"});
  });

  it("selects the latest immutable Daily segment without remapping earlier dates", async () => {
    const extendedContent: YouTubeContent = {
      ...content,
      daily: {
        scheduleVersion: 2,
        segments: [
          content.daily.segments[0],
          {startsOn: "2026-01-03", canonicalIds: ["riddle:moon"]},
        ],
      },
    };
    const beforeSegment = await LocalSoloAuthority.restore(
      createEmptyYouTubeSave(content.contentVersion),
      extendedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
      () => new Date("2026-01-02T12:00:00.000Z"),
    );
    await beforeSegment.start("daily");
    expect(beforeSegment.getSnapshot().save.activeGame?.riddleId).toBe("riddle:moon");

    const onNewSegment = await LocalSoloAuthority.restore(
      createEmptyYouTubeSave(content.contentVersion),
      extendedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
      () => new Date("2026-01-03T12:00:00.000Z"),
    );
    await onNewSegment.start("daily");
    expect(onNewSegment.getSnapshot().save.activeGame?.riddleId).toBe("riddle:moon");
  });

  it("drops only an active puzzle whose fingerprint changed and commits the recovery", async () => {
    const loaded = createEmptyYouTubeSave("older-content");
    loaded.revision = 3;
    loaded.progression.coins = 777;
    loaded.activeGame = {
      sessionRevision: 2,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "ffffffffffffffff",
      hintRevealedIndices: [],
      guesses: [],
      attemptsUsed: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await createAuthority(saveData, loaded);
    const snapshot = authority.getSnapshot();
    expect(snapshot.recoveryNotice).toBe(true);
    expect(snapshot.save.activeGame).toBeNull();
    expect(snapshot.save.progression.coins).toBe(777);
    expect(snapshot.save.contentVersion).toBe("content-v1");
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("drops active riddles that do not match Classic progression or the immutable Daily schedule", async () => {
    for (const activeGame of [
      {
        sessionRevision: 2,
        mode: "classic" as const,
        riddleId: "riddle:moon",
        contentFingerprint: "abcdef0123456789",
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      },
      {
        sessionRevision: 2,
        mode: "daily" as const,
        riddleId: "riddle:moon",
        contentFingerprint: "abcdef0123456789",
        dailyDate: "2026-01-01",
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      },
    ]) {
      const loaded = createEmptyYouTubeSave(content.contentVersion);
      loaded.revision = 2;
      loaded.progression.coins = 777;
      loaded.activeGame = activeGame;
      const saveData = jest.fn(async (_data: string) => undefined);
      const authority = await createAuthority(saveData, loaded);
      expect(authority.getSnapshot()).toMatchObject({
        recoveryNotice: true,
        save: {activeGame: null, progression: {coins: 777}, revision: 3},
      });
      expect(saveData).toHaveBeenCalledTimes(1);
    }
  });

  it("retains the exact sanitized recovery revision when its startup save is uncertain", async () => {
    const loaded = createEmptyYouTubeSave("older-content");
    loaded.revision = 3;
    loaded.progression.coins = 777;
    const saveData = jest.fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValueOnce(undefined);
    let blocked: YouTubeAuthorityRestoreSaveError | null = null;
    try {
      await createAuthority(saveData, loaded);
    } catch (error) {
      if (error instanceof YouTubeAuthorityRestoreSaveError) blocked = error;
      else throw error;
    }
    expect(blocked).not.toBeNull();
    const exactPayload = saveData.mock.calls[0]?.[0];
    await blocked!.authority.retryPendingSave();
    expect(saveData.mock.calls[1]?.[0]).toBe(exactPayload);
    expect(blocked!.authority.getSnapshot().save).toMatchObject({
      contentVersion: "content-v1",
      progression: {coins: 777},
      revision: 4,
    });
  });

  it("commits an explicit schema migration before restored play becomes available", async () => {
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await LocalSoloAuthority.restore(
      loaded,
      content,
      new YouTubeSaveGate({saveData}),
      undefined,
      false,
      true,
    );
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saveData.mock.calls[0]?.[0] ?? "null")).toMatchObject({schemaVersion: 1, revision: 1});
    expect(authority.getSnapshot().save.revision).toBe(1);
  });

  it("resumes an unfinished Daily across UTC midnight to preserve the global mode lock", async () => {
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.revision = 7;
    loaded.progression.coins = 888;
    loaded.activeGame = {
      sessionRevision: 6,
      mode: "daily",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      dailyDate: "2026-01-01",
      hintRevealedIndices: [],
      guesses: [],
      attemptsUsed: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await LocalSoloAuthority.restore(
      loaded,
      content,
      new YouTubeSaveGate({saveData}),
      () => new Date("2026-01-02T12:00:00.000Z"),
    );
    expect(authority.getSnapshot()).toMatchObject({
      recoveryNotice: false,
      save: {activeGame: {dailyDate: "2026-01-01"}, progression: {coins: 888}, revision: 7},
    });
    expect(saveData).not.toHaveBeenCalled();
    await expect(authority.start("classic")).rejects.toMatchObject({code: "active-game-must-resume"});
  });

  it("keeps the canonical active puzzle locked across an SDK-language change", async () => {
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.revision = 7;
    loaded.activeGame = {
      sessionRevision: 6,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      hintRevealedIndices: [3],
      guesses: [{letters: ["n", "o", "p", "e"], feedback: ["red", "green", "red", "green"]}],
      attemptsUsed: 1,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    const localizedRiddle: YouTubeRiddle = {
      ...riddles[0],
      text: "Quelle ville ancienne ?",
      answer: "astre",
      // Save-facing fingerprints are canonical and therefore identical in every locale.
      contentFingerprint: "0123456789abcdef",
    };
    const localizedContent: YouTubeContent = {
      ...content,
      locale: "fr",
      riddles: new Map([
        [localizedRiddle.canonicalId, localizedRiddle],
        [riddles[1].canonicalId, {...riddles[1], text: "Lumière nocturne ?", answer: "astre"}],
      ]),
    };
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await LocalSoloAuthority.restore(
      loaded,
      localizedContent,
      new YouTubeSaveGate({saveData}),
    );

    expect(authority.getSnapshot()).toMatchObject({
      recoveryNotice: false,
      save: {
        revision: 7,
        activeGame: {riddleId: "riddle:rome", attemptsUsed: 1, hintRevealedIndices: [3]},
      },
    });
    expect(authority.getSnapshot().displayLetters).toEqual(["", "", "", "r", ""]);
    expect(saveData).not.toHaveBeenCalled();
    await expect(authority.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});

    authority.setInput(["c", "h", "i", "r", "n"], 4);
    await expect(authority.submitGuess()).resolves.toBeNull();
    const serialized = saveData.mock.calls[0]?.[0] ?? "";
    const parsed = parseYouTubeSave(serialized, localizedContent.contentVersion);
    expect(parsed.kind).toBe("valid");
    if (parsed.kind !== "valid") throw new Error(`cross-locale-save-invalid:${parsed.kind}`);
    expect(parsed.save.activeGame?.guesses.map(({letters}) => letters.length)).toEqual([4, 5]);
    const reloaded = await LocalSoloAuthority.restore(
      parsed.save,
      localizedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
    );
    expect(reloaded.getSnapshot().save.activeGame?.riddleId).toBe("riddle:rome");
    await expect(reloaded.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});
  });

  it("does not allow a device-clock rollback to replay a completed Daily", async () => {
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.progression.lastDailyCompletedDate = "2026-01-02";
    const authority = await createAuthority(
      async () => undefined,
      loaded,
      () => new Date("2026-01-01T12:00:00.000Z"),
    );
    await expect(authority.start("daily")).rejects.toMatchObject({code: "daily-already-complete"});
  });

  it("blocks mutation while paused", async () => {
    const authority = await createAuthority();
    authority.setPaused(true);
    await expect(authority.start("classic")).rejects.toEqual(new YouTubeAuthorityError("game-paused"));
  });

  it("durably applies accessibility and guidance preferences", async () => {
    const persisted: string[] = [];
    const authority = await createAuthority(async (data) => { persisted.push(data); });
    await authority.setAccessibilityPreference("reducedMotion", true);
    await authority.setAccessibilityPreference("highContrast", true);
    await authority.completeGuidance();
    expect(authority.getSnapshot().save.preferences).toEqual({
      reducedMotion: true,
      highContrast: true,
      guidanceComplete: true,
    });
    expect(JSON.parse(persisted.at(-1) ?? "null")).toMatchObject({
      preferences: {reducedMotion: true, highContrast: true, guidanceComplete: true},
    });
  });

  it("stages serialization before publishing a near-budget material mutation", async () => {
    const loaded = createNearBudgetSave(150);
    const raw = serializeYouTubeSave(loaded);
    expect(raw.length * 2).toBeLessThan(YOUTUBE_SAVE_BUDGET_BYTES);
    const parsed = parseYouTubeSave(raw, content.contentVersion);
    if (parsed.kind !== "valid") {
      throw new Error(`near-budget-save-invalid:${parsed.kind === "invalid" ? parsed.reason : parsed.kind}`);
    }
    const saveData = jest.fn(async (_data: string) => undefined);
    const authority = await createAuthority(saveData, parsed.save);
    const before = authority.getSnapshot().save;

    await expect(authority.buyContinue()).rejects.toThrow("youtube-save-budget-exceeded");
    expect(authority.getSnapshot()).toMatchObject({
      busy: false,
      saveBlocked: false,
      save: {revision: before.revision, progression: {coins: before.progression.coins}, activeGame: {
        awaitingContinue: true,
        hasUsedContinue: false,
      }},
    });
    expect(saveData).not.toHaveBeenCalled();
  });

  it("blocks startup when a prerelease migration cannot be serialized within budget", async () => {
    const migrated = createNearBudgetSave(151);
    const {preferences: _preferences, ...legacy} = migrated;
    const raw = JSON.stringify({...legacy, schemaVersion: 0});
    expect(raw.length * 2).toBeLessThan(YOUTUBE_SAVE_BUDGET_BYTES);
    const parsed = parseYouTubeSave(raw, content.contentVersion);
    if (parsed.kind !== "valid") {
      throw new Error(`near-budget-migration-invalid:${parsed.kind === "invalid" ? parsed.reason : parsed.kind}`);
    }
    const saveData = jest.fn(async (_data: string) => undefined);
    await expect(LocalSoloAuthority.restore(
      parsed.save,
      content,
      new YouTubeSaveGate({saveData}),
      undefined,
      false,
      true,
    )).rejects.toThrow("youtube-save-budget-exceeded");
    expect(saveData).not.toHaveBeenCalled();
  });
});
