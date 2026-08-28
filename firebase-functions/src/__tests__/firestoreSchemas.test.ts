import {
  PlayerProgressSchema,
  PlayerStatsSchema,
  PlayerSchema,
  FirestoreRiddleSchema,
  ClassicRiddleSchema,
  RiddleCollections,
  type Player,
  type FirestoreRiddle,
} from "../validation/firestoreSchemas";

describe("Firestore Schemas", () => {
  describe("PlayerSchema", () => {
    test("validates a player with a clean username", () => {
      /** Provides player behavior. */
      const player: Player = {
        userId: "user-1",
        email: "test@example.com",
        username: "testuser",
      } as Player;

      /** Provides result behavior. */
      const result = PlayerSchema.safeParse(player);
      expect(result.success).toBe(true);
    });

    test("rejects usernames flagged by the profanity filter", () => {
      /** Provides result behavior. */
      const result = PlayerSchema.safeParse({
        userId: "user-1",
        username: "badword",
        email: "test@example.com",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("PlayerProgressSchema", () => {
    test("fills defaults for missing progress values", () => {
      /** Provides result behavior. */
      const result = PlayerProgressSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.classicIndex).toBe(1);
        expect(result.data.dailyChallengeIndex).toBe(0);
      }
    });
  });

  describe("PlayerStatsSchema", () => {
    test("fills defaults for missing stats values", () => {
      /** Provides result behavior. */
      const result = PlayerStatsSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.level).toBe(1);
        expect(result.data.xp).toBe(0);
      }
    });
  });

  describe("FirestoreRiddleSchema", () => {
    test("validates a minimal riddle record", () => {
      /** Provides riddle behavior. */
      const riddle: FirestoreRiddle = {
        riddleId: "riddle-1",
        text: "What has four legs?",
        answer: "TABLE",
      };

      /** Provides result behavior. */
      const result = FirestoreRiddleSchema.safeParse(riddle);
      expect(result.success).toBe(true);
    });
  });

  describe("ClassicRiddleSchema", () => {
    test("validates a classic riddle record", () => {
      /** Provides result behavior. */
      const result = ClassicRiddleSchema.safeParse({
        riddleId: "riddle-1",
        text: "What has four legs?",
        answer: "TABLE",
        classicIndex: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("RiddleCollections", () => {
    test("exposes canonical collection names", () => {
      expect(RiddleCollections).toEqual({
        RIDDLES: "riddles",
        DAILY_RIDDLES: "dailyRiddles",
      });
    });
  });
});
