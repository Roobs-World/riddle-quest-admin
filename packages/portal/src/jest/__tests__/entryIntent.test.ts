import {parseEntryIntent} from "../entryIntent";

describe("parseEntryIntent", () => {
  it("allowlists supported fields", () => expect(parseEntryIntent({
    gameMode: "challenge",
    campaign: "summer",
    inviterName: "Sam",
    challengeId: "daily-42",
    evil: "no",
  })).toEqual({
    gameMode: "challenge",
    campaign: "summer",
    reference: undefined,
    challengeDestination: undefined,
    customName: undefined,
    inviterName: "Sam",
    challengeId: "daily-42",
  }));
  it("rejects malformed values", () => expect(parseEntryIntent({gameMode: "admin", campaign: {}})).toEqual({
    gameMode: undefined,
    campaign: undefined,
    reference: undefined,
    challengeDestination: undefined,
    customName: undefined,
    inviterName: undefined,
    challengeId: undefined,
  }));
});
