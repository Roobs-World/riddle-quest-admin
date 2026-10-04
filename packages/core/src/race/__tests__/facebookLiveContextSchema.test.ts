import {JoinLiveRaceSchema} from "../raceLiveSchemas";

/** Exact portable join plus the owning Facebook SDK selector. */
const input = {locale: "en", categoryId: "history", requestId: "facebook-context-join"};
it("accepts a bounded raw SDK context selector but rejects private authority fields", () => {
  expect(JoinLiveRaceSchema.parse({...input, facebookContextId: "thread.1:group-test"}).facebookContextId).toBe("thread.1:group-test");
  for (const facebookContextId of ["", "x".repeat(257), "../group", "https://group", "group\n"])
    expect(JoinLiveRaceSchema.safeParse({...input, facebookContextId}).success).toBe(false);
  expect(JoinLiveRaceSchema.safeParse({...input, facebookContext: {contextKey: "a".repeat(64), createdAtMs: 1, joinedAtMs: 1}}).success).toBe(false);
  expect(JoinLiveRaceSchema.parse(input)).toEqual(input);
});
