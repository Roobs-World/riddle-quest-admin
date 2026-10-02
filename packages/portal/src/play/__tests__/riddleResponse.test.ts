import {mapRiddleResponse} from "../riddleResponse";

it("preserves authoritative Daily completion as a distinct launch outcome", () => {
  expect(() => mapRiddleResponse({hasCompletedToday: true, error: "Today's daily challenge is already complete."}, "challenge"))
    .toThrow(expect.objectContaining({code: "daily-completed"}));
});
it.each(["No daily challenge available at the moment.", "Today's daily challenge is already complete."])("does not infer completion from error text: %s", error => {
  try { mapRiddleResponse({error}, "challenge"); throw new Error("Expected load failure"); }
  catch (failure) { expect(failure).not.toHaveProperty("code", "daily-completed"); }
});
