import {mapRiddleResponse} from "@qwordly/hosted/riddleResponse";

it("preserves authoritative Daily completion as a distinct launch outcome", () => {
  expect(() => mapRiddleResponse({hasCompletedToday: true, error: "Today's daily challenge is already complete."}, "challenge"))
    .toThrow(expect.objectContaining({code: "daily-completed"}));
});
it.each(["No daily challenge available at the moment.", "Today's daily challenge is already complete."])("does not infer completion from error text: %s", error => {
  try { mapRiddleResponse({error}, "challenge"); throw new Error("Expected load failure"); }
  catch (failure) { expect(failure).not.toHaveProperty("code", "daily-completed"); }
});

 it("maps authoritative purchased hints through the host boundary", () => {
  expect(mapRiddleResponse({challenge: {totalQuestions: 1, questions: [{
    riddleId: "classic-1", text: "Clue", answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000001", questionNumber: 1,
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
    revealedHints: [{index: 0, letter: "P"}],
  }]}}, "classic").revealedHints).toEqual([{index: 0, letter: "P"}]);
});
