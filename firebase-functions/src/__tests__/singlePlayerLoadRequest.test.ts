import {describe, expect, it} from "@jest/globals";
import {
  MAX_CLASSIC_LOAD_INDEX,
  parseClassicLoadIndex,
  parseSinglePlayerResumeFields,
} from "../gameplay/singlePlayerLoadRequest";

/** Renders the token interface. */
const TOKEN = "00000000-0000-4000-8000-000000000001";

describe("single-player load request parsing", () => {
  it("accepts either no resume identity or one bounded string pair", () => {
    expect(parseSinglePlayerResumeFields(undefined)).toBeUndefined();
    expect(parseSinglePlayerResumeFields({sessionToken: TOKEN, riddleId: "classic-1"})).toEqual({
      sessionToken: TOKEN,
      riddleId: "classic-1",
    });
  });

  it.each([
    {sessionToken: TOKEN},
    {riddleId: "classic-1"},
    {sessionToken: 1, riddleId: 1},
    {sessionToken: "short", riddleId: "classic-1"},
    {sessionToken: TOKEN, riddleId: "r".repeat(161)},
  ])("rejects malformed resume fields %#", (data) => {
    expect(() => parseSinglePlayerResumeFields(data)).toThrow("valid resume token and riddle id");
  });

  it("bounds the caller-provided Classic index", () => {
    expect(parseClassicLoadIndex(0)).toBe(0);
    expect(parseClassicLoadIndex(MAX_CLASSIC_LOAD_INDEX)).toBe(MAX_CLASSIC_LOAD_INDEX);
    expect(() => parseClassicLoadIndex(MAX_CLASSIC_LOAD_INDEX + 1)).toThrow("bounded non-negative");
    expect(() => parseClassicLoadIndex(1.5)).toThrow("bounded non-negative");
  });
});
