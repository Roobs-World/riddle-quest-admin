import {parseRedditGameplayOperation, REDDIT_GAMEPLAY_OPERATIONS} from "../redditGameplayEndpoint";

describe("Reddit gameplay operation allowlist", () => {
  it("accepts every exact supported operation", () => {
    for (const operation of REDDIT_GAMEPLAY_OPERATIONS) {
      expect(parseRedditGameplayOperation({operation})).toBe(operation);
    }
  });

  it.each([
    null,
    {},
    {operation: ""},
    {operation: "gameplay.profile.avatar"},
    {operation: "gameplay.purchase.grant"},
    {operation: "gameplay.race.live.update.command"},
    {operation: "gameplay.riddle.classic.extra"},
    {operation: ["gameplay.profile.load"]},
  ])("rejects unsupported or malformed operations: %p", (assertion) => {
    expect(() => parseRedditGameplayOperation(assertion)).toThrow("invalid-reddit-gameplay-operation");
  });
});
