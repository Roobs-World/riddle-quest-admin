import {RiddleCollections} from "../firestoreSchemas";

describe("firestoreSchemas", () => {
  it("exposes canonical riddle collection names", () => {
    expect(RiddleCollections).toEqual({
      RIDDLES: "riddles",
      DAILY_RIDDLES: "dailyRiddles",
    });
  });
});
