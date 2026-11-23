import {JoinLiveRaceSchema} from "../raceLiveSchemas";

/** Valid public Race request used by the recovery boundary cases. */
const join = {locale: "en", categoryId: "history", requestId: "public-recovery-001"};
/** Opaque existing public seat supplied to recovery requests. */
const ticketId = "a".repeat(64);

it("accepts a public search and recovery of its existing seat", () => {
  /** Public search without a private opponent selector. */
  const search = {...join, waitForPlayer: true};
  expect(JoinLiveRaceSchema.parse(search)).toEqual(search);
  /** Public request resuming the same opaque seat. */
  const recovery = {...search, resumeTicketId: ticketId};
  expect(JoinLiveRaceSchema.parse(recovery)).toEqual(recovery);
});

it("requires public-search mode when recovering an existing seat", () => {
  expect(JoinLiveRaceSchema.safeParse({...join, resumeTicketId: ticketId}).success).toBe(false);
});

it.each([
  {createChallenge: true},
  {challengeId: `live_${"b".repeat(64)}`},
  {rematchOfTicketId: ticketId},
])("rejects a private opponent selector during public search: %p", selector => {
  expect(JoinLiveRaceSchema.safeParse({...join, waitForPlayer: true, ...selector}).success).toBe(false);
});
