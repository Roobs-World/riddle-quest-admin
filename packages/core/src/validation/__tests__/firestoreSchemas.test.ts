import {
  ClassicRiddleSchema,
  DailyRiddleSchema,
  FirestoreRiddleSchema,
  PlayerSchema,
  ProductPricingSchema,
  RiddleCollections,
} from "../firestoreSchemas";

/** Provides base player behavior. */
const basePlayer = {userId: "user-1", email: "player@example.com", username: "Solver"};

describe("Firestore schemas", () => {
  it("applies complete player defaults", () => {
    /** Provides player behavior. */
    const player = PlayerSchema.parse(basePlayer);
    expect(player).toMatchObject({
      coins: 0,
      hasPurchasedApp: false,
      progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
      stats: {xp: 0, level: 1, multiplayerWins: 0},
      unlockedAchievements: [],
    });
  });

  it.each([
    ["number", 1234, 1234],
    ["ISO string", "2026-08-03T00:00:00.000Z", Date.parse("2026-08-03T00:00:00.000Z")],
    ["Date", new Date(4567), 4567],
    ["toMillis", {toMillis: () => 6789}, 6789],
    ["toDate", {toDate: () => new Date(7890)}, 7890],
    ["seconds", {seconds: 8, nanoseconds: 900_000_000}, 8900],
    ["seconds without nanos", {seconds: 9}, 9000],
  ])("coerces a %s timestamp", (_label, input, expected) => {
    expect(PlayerSchema.parse({...basePlayer, createdAt: input}).createdAt).toBe(expected);
  });

  it("rejects invalid timestamps, emails, profanity, and negative balances", () => {
    expect(() => PlayerSchema.parse({...basePlayer, createdAt: "not-a-date"})).toThrow();
    expect(() => PlayerSchema.parse({...basePlayer, email: "invalid"})).toThrow();
    expect(() => PlayerSchema.parse({...basePlayer, username: "shit"})).toThrow();
    expect(() => PlayerSchema.parse({...basePlayer, coins: -1})).toThrow();
    expect(() => PlayerSchema.parse({...basePlayer, createdAt: {}})).toThrow();
    expect(() => PlayerSchema.parse({...basePlayer, createdAt: true})).toThrow();
  });

  it("parses classic, daily, and generic riddles", () => {
    expect(ClassicRiddleSchema.parse({riddleId: "c1", text: "Clue", answer: "time", classicIndex: 0})).toMatchObject({
      category: "classic",
    });
    expect(
      DailyRiddleSchema.parse({riddleId: "d1", text: "Clue", answer: "time", dailyIndex: 0, timestamp: 1}),
    ).toMatchObject({
      category: "daily",
    });
    expect(FirestoreRiddleSchema.parse({riddleId: "r1", text: "Clue", answer: "time"}).answer).toBe("time");
    expect(RiddleCollections).toEqual({RIDDLES: "riddles", DAILY_RIDDLES: "dailyRiddles"});
  });

  it("defaults pricing arrays and preserves provider extensions", () => {
    expect(
      ProductPricingSchema.parse({
        productId: "sku",
        productKey: "PACK",
        name: "Pack",
        description: "Coins",
        coins: 10,
        isActive: true,
        sortOrder: 1,
        providerField: "kept",
      }),
    ).toMatchObject({regionalPrices: [], providerField: "kept"});
  });
});
