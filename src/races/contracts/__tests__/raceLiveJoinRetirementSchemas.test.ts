import {JoinLiveRaceSchema, RetireLiveRaceJoinSchema, RetireLiveRaceJoinResponseSchema} from "../raceLiveSchemas";

/** Legacy bodies retain their original exact shape without opting into durable retirement. */
const join = {locale: "en", categoryId: "history", requestId: "original-join-request"};
it("preserves legacy joins and validates the modern account precondition", () => {
  expect(JoinLiveRaceSchema.parse(join)).toEqual(join);
  expect(JoinLiveRaceSchema.parse({...join, retirementAware: true, expectedOwnerId: "facebook_owner"})).toEqual({...join, retirementAware: true, expectedOwnerId: "facebook_owner"});
});
it.each([false, 1, "true"])("rejects a malformed retirement opt-in %p", retirementAware => {
  expect(JoinLiveRaceSchema.safeParse({...join, retirementAware}).success).toBe(false);
});
it.each(["", "x".repeat(129), 1])("rejects a malformed expected account %p", expectedOwnerId => {
  expect(JoinLiveRaceSchema.safeParse({...join, expectedOwnerId}).success).toBe(false);
  expect(RetireLiveRaceJoinSchema.safeParse({requestId: join.requestId, expectedOwnerId}).success).toBe(false);
});
it.each([{ticketId: "a".repeat(64)}, {userId: "someone"}, {coins: 50}, {locale: "en"}])("retirement cannot select extra authority: %p", extra => {
  expect(RetireLiveRaceJoinSchema.safeParse({requestId: join.requestId, ...extra}).success).toBe(false);
});
it.each(["retired", "superseded"])("validates the answer-free %s acknowledgement", status => {
  expect(RetireLiveRaceJoinResponseSchema.parse({status})).toEqual({status});
  expect(RetireLiveRaceJoinResponseSchema.safeParse({status, ticketId: "a".repeat(64)}).success).toBe(false);
});
it.each(["", "active", null, 1])("rejects an unknown retirement outcome %p", status => {
  expect(RetireLiveRaceJoinResponseSchema.safeParse({status}).success).toBe(false);
});
