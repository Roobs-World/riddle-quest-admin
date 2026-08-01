import {ClassicRiddleSchema, RiddleCollections} from "../firestoreSchemas";

describe("firestoreSchemas", () => {
  it("exposes canonical riddle collection names", () => {
    expect(RiddleCollections).toEqual({
      RIDDLES: "riddles",
      DAILY_RIDDLES: "dailyRiddles",
    });
  });

  it("keeps legacy riddles valid while accepting race metadata", () => {
    const legacy = {
      riddleId: "classic_1",
      text: "What has keys but opens no doors?",
      answer: "piano",
      classicIndex: 1,
    };
    const raceReady = {
      ...legacy,
      canonicalRiddleId: "classic:1",
      categoryId: "music",
      difficultyBand: "easy",
      raceEligible: true,
      qualityVersion: "human_review_v1",
    };

    expect(ClassicRiddleSchema.safeParse(legacy).success).toBe(true);
    expect(ClassicRiddleSchema.safeParse(raceReady).success).toBe(true);
    expect(ClassicRiddleSchema.safeParse({...raceReady, categoryId: "classic"}).success).toBe(false);
  });
});
