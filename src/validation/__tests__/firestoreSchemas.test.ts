import {PlayerSchema, FirestoreRiddleSchema} from "@qwordly/core/validation/firestoreSchemas";

describe("firestoreSchemas", () => {
  describe("PlayerSchema", () => {
    it("validates a player with a clean username", () => {
      const result = PlayerSchema.safeParse({
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
    });

    it("rejects a player with a profane username", () => {
      const result = PlayerSchema.safeParse({
        userId: "user123",
        username: "badword",
        email: "test@example.com",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("FirestoreRiddleSchema", () => {
    it("validates correct riddle data", () => {
      const validRiddle = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
        category: "objects",
        dailyIndex: 5,
      };

      const result = FirestoreRiddleSchema.safeParse(validRiddle);
      expect(result.success).toBe(true);
    });

    it("rejects riddle with empty answer", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "",
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });
  });
});
