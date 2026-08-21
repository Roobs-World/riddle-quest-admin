import type {RaceDifficultyBand, RaceLocale} from "@qwordly/core/race";
import type {ExistingRaceContentRecord} from "../../race/raceContentMigration";
import {buildDeterministicRaceDeck} from "../../race/raceService";
import {assertRaceLocaleCompatible, type RaceChallengeRecord} from "../../race/raceSetupService";

const makePool = (locale: RaceLocale): ExistingRaceContentRecord[] =>
  Array.from({length: 30}, (_, index) => {
    const difficultyBand: RaceDifficultyBand = (["easy", "medium", "hard"] as const)[index % 3];
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
  it("rejects challenge, rematch, and rivalry entry across locale boundaries", () => {
    const challenge = {locale: "ja"} as RaceChallengeRecord;
    expect(() => assertRaceLocaleCompatible(challenge, "ja")).not.toThrow();
    expect(() => assertRaceLocaleCompatible(challenge, "en"))
      .toThrow("RaceTo10.ERROR_LOCALE_MISMATCH");
  });
  it("selects a deterministic balanced 15-riddle deck", () => {
    const first = buildDeterministicRaceDeck(makePool("en"), {
      locale: "en",
      categoryId: "history",
      seed: "run-123",
    });
    const second = buildDeterministicRaceDeck(makePool("en"), {
      locale: "en",
      categoryId: "history",
      seed: "run-123",
    });

    expect(second).toEqual(first);
    expect(first.riddles).toHaveLength(15);
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
    ).toEqual({easy: 5, medium: 5, hard: 5});
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
