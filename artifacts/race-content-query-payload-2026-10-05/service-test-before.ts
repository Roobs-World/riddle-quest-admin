import {RACE_RULES, type RaceDifficultyBand, type RaceLocale} from "@qwordly/core/race";
import type {ExistingRaceContentRecord} from "../../race/raceContentMigration";
import {buildDeterministicRaceDeck} from "../../race/raceService";
import {assertRaceLocaleCompatible, resolveChallengeRiddles, type RaceChallengeRecord} from "../../race/raceSetupService";

/** Creates pool. */
const makePool = (locale: RaceLocale): ExistingRaceContentRecord[] =>
  Array.from({length: 30}, (_, index) => {
    /** Provides difficulty band behavior. */
    const difficultyBand: RaceDifficultyBand = (["easy", "medium", "hard"] as const)[index % 3];
    /** Provides canonical riddle id behavior. */
    const canonicalRiddleId = `history:${index + 1}`;
    return {
      locale,
      documentPath: `localizedRiddles/${locale}/riddles/history-${index + 1}`,
      data: {
        riddleId: `${locale}-history-${index + 1}`,
        canonicalRiddleId,
        text: `${locale} clue ${index + 1} follows its own unique trail`,
        answer: `a${String(index + 1).padStart(6, "0")}`,
        categoryId: "history",
        difficultyBand,
        raceEligible: true,
        qualityVersion: "human_review_v1",
      },
    };
  });

describe("Race to 10 deterministic deck service", () => {
  it("keeps the creator's immutable deck after catalog riddles are edited or retired", async () => {
    /** Provides riddle behavior. */
    const riddle = {riddleId: "retired-riddle", canonicalRiddleId: "history:retired",
      text: "Which ship sank in 1912?", answer: "titanic", position: 0};
    /** Provides challenge behavior. */
    const challenge = {locale: "en", canonicalRiddleIds: [riddle.canonicalRiddleId], riddles: [riddle]} as RaceChallengeRecord;
    /** Provides db behavior. */
    const db = {} as FirebaseFirestore.Firestore;
    await expect(resolveChallengeRiddles(db, "en", challenge)).resolves.toEqual([riddle]);
  });

  it("resolves legacy challenges from the original creator run, never the mutable catalog", async () => {
    /** Ordered original creator deck remains available despite mutable catalog removal. */
    const riddles = Array.from({length: 10}, (_, position) => ({riddleId: `original-${position}`, canonicalRiddleId: `history:original-${position}`, text: "Original clue", answer: "original", position}));
    /** Legacy metadata agrees with its complete source recording. */
    const challenge = {locale: "en", creatorId: "creator", creatorRunId: "original-run", categoryId: "history", deckId: "deck",
      targetCorrect: 10, creatorWallFinishMs: 10000, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0,
      rules: RACE_RULES, ghostEvents: [], createdAtMs: 12000, canonicalRiddleIds: riddles.map(riddle => riddle.canonicalRiddleId)} as RaceChallengeRecord;
    /** Compact emulator seam supplies a complete canonical creator record. */
    const data = {runId: "original-run", userId: "creator", role: "creator", status: "completed", result: "recorded", locale: "en",
      categoryId: "history", rulesVersion: RACE_RULES.version, deckId: "deck", riddles, currentPosition: 9, correctCount: 10,
      guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000, wallFinishMs: 10000, finishedAtMs: 11000,
      hintPenaltyMs: 0, skipPenaltyMs: 0, events: []};
    /** Reads only the requested original run, never catalog content. */
    const db = {doc: () => ({get: async () => ({exists: true, data: () => data})})} as unknown as FirebaseFirestore.Firestore;
    await expect(resolveChallengeRiddles(db, "en", challenge)).resolves.toEqual(riddles);
    data.runId = "another-run";
    await expect(resolveChallengeRiddles(db, "en", challenge)).rejects.toThrow("original challenge deck is unavailable");
    data.runId = "original-run"; data.role = "challenger";
    await expect(resolveChallengeRiddles(db, "en", challenge)).rejects.toThrow("recording does not match its source");
  });

  it("rejects a legacy challenge if its authoritative content is no longer recoverable", async () => {
    /** Provides challenge behavior. */
    const challenge = {locale: "en", creatorRunId: "gone", canonicalRiddleIds: []} as unknown as RaceChallengeRecord;
    /** Provides db behavior. */
    const db = {doc: () => ({get: async () => ({exists: false, data: () => undefined})})} as unknown as FirebaseFirestore.Firestore;
    await expect(resolveChallengeRiddles(db, "en", challenge)).rejects.toThrow("original challenge deck is unavailable");
  });

  it("rejects challenge, rematch, and rivalry entry across locale boundaries", () => {
    /** Provides challenge behavior. */
    const challenge = {locale: "ja"} as RaceChallengeRecord;
    expect(() => assertRaceLocaleCompatible(challenge, "ja")).not.toThrow();
    expect(() => assertRaceLocaleCompatible(challenge, "en")).toThrow("RaceTo10.ERROR_LOCALE_MISMATCH");
  });
  it("selects a deterministic 15-riddle deck with no hard riddles", () => {
    /** Provides first behavior. */
    const first = buildDeterministicRaceDeck(makePool("en"), {
      locale: "en",
      categoryId: "history",
      seed: "run-123",
    });
    /** Provides second behavior. */
    const second = buildDeterministicRaceDeck(makePool("en"), {
      locale: "en",
      categoryId: "history",
      seed: "run-123",
    });

    expect(second).toEqual(first);
    expect(first.riddles).toHaveLength(15);
    /** Provides by difficulty behavior. */
    const byDifficulty = new Map(
      makePool("en").map((record) => [record.data.canonicalRiddleId, record.data.difficultyBand]),
    );
    expect(
      first.riddles.reduce(
        (counts, riddle) => ({
          ...counts,
          [byDifficulty.get(riddle.canonicalRiddleId)!]: counts[byDifficulty.get(riddle.canonicalRiddleId)!] + 1,
        }),
        {easy: 0, medium: 0, hard: 0},
      ),
    ).toEqual({easy: 10, medium: 5, hard: 0});
  });

  it("rejects an undersized competitive pool", () => {
    expect(() =>
      buildDeterministicRaceDeck(makePool("en").slice(0, 15), {
        locale: "en",
        categoryId: "history",
        seed: "too-small",
      }),
    ).toThrow("Race category is not ready");
  });
});
