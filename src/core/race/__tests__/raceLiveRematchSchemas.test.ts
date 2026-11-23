import {JoinLiveRaceSchema} from "../raceLiveSchemas";

/** Owned terminal seat supplies private opponent selection; the client supplies no rival identifier. */
const input = {locale: "en", categoryId: "history", requestId: "rematch-join-001", rematchOfTicketId: "a".repeat(64)};

it("accepts an owned opaque rematch source as its only private selection", () => {
  expect(JoinLiveRaceSchema.parse(input)).toEqual(input);
});

it.each([
  {...input, createChallenge: true},
  {...input, challengeId: `live_${"b".repeat(64)}`},
  {...input, recipientUserId: "private-rival"},
  {...input, rematchOfTicketId: "../seat"},
])("rejects mixed or client-selected private rematch authority", value => {
  expect(JoinLiveRaceSchema.safeParse(value).success).toBe(false);
});
