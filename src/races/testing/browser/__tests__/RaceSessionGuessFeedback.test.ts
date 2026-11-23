import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing, withCorrectHistory} from "../../../browser/controllers/__tests__/raceSession.support.ts";
import {createFakeRaceServices} from "../fakeRaceServices";

describe("Race Session submitted feedback ownership", () => {
  it.each(["empty", "short", "letter", "multiple-graphemes", "status", "correctness", "wrong-yellow"])("rejects mismatched submitted feedback: %s", async corruption => {
    /** The original submission, authority and later draft remain independent. */
    const h = await racing();
    /** Wrong guesses exercise exact color validation beyond the all-green correctness flag. */
    const guess = corruption === "wrong-yellow" ? "zzzzz" : "piano";
    h.session.input("text", guess);h.session.submit();h.session.input("text", "clo");
    /** The actual committed run is preserved behind a malformed transport echo. */
    const response = structuredClone(await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess, requestId: "feedback-submission"}));
    if (corruption === "empty") response.feedback = [];
    if (corruption === "short") response.feedback.pop();
    if (corruption === "letter") response.feedback[0].letter = "x";
    if (corruption === "multiple-graphemes") response.feedback[0].letter = "pp";
    if (corruption === "status") response.feedback[0].status = "red";
    if (corruption === "correctness") response.isCorrect = false;
    if (corruption === "wrong-yellow") response.feedback[0].status = "yellow";
    h.respond("raceGuess", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [...guess], run: {correctCount: 0, currentRiddle: {position: 0}}});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["c", "l", "o", "", ""], run: {correctCount: corruption === "wrong-yellow" ? 0 : 1}});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
  });
  it.each(["short", "letter", "valid"])("validates answer-free legacy feedback without requiring a local answer: %s", async corruption => {
    /** Answer-free views still own the exact submitted graphemes. */
    const authority = createFakeRaceServices();
    /** This genuinely legacy start never exposes evaluation or a preload deck. */
    const {run} = await authority.startRace({locale: "en", categoryId: "mixed", requestId: "legacy-feedback", includeEvaluation: false});
    /** Editing stays bound to the original question while the response is pending. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");h.respond("raceStart", {run});h.advance(3480);
    h.session.input("text", "piano");h.session.submit();
    /** Canonical authority can advance even though the old caller cannot project locally. */
    const response = structuredClone(await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "piano", requestId: "legacy-answer"}));
    if (corruption === "short") response.feedback.pop();
    if (corruption === "letter") response.feedback[0].letter = "x";
    h.respond("raceGuess", response);
    if (corruption === "valid") expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}}});
    else {
      expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [..."piano"], run: {correctCount: 0}});
      h.session.retry();h.respond("raceResume", await authority.resumeRace(run.runId));
      expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}}});
    }
  });
  it.each(["e\u0301", "É"])("accepts canonically equivalent submitted feedback %s", async letter => {
    /** Composition and casing must not break a valid one-grapheme acknowledgement. */
    const run = await fixture();run.currentRiddle!.answerLength = 1;run.currentRiddle!.evaluation!.answer = "é";
    Object.assign(run.preloadedRiddles![0], {answerLength: 1, evaluation: {answer: "é", locale: "en"}, hint: {index: 0, letter: "é"}});
    /** Full deck remains immutable while the first Unicode answer projects its successor. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");h.respond("raceStart", {run});h.advance(3480);
    h.session.input("text", "é");h.session.submit();
    /** Valid scoring evidence is independent of normalization in the feedback echo. */
    const projected = h.session.getSnapshot().run!;
    /** Server sample agrees with the projected elapsed clock, and prompt omits preload-only hints. */
    const confirmed = withCorrectHistory({...projected, serverNowMs: projected.startsAtMs! + projected.wallElapsedMs});
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    h.respond("raceGuess", {run: confirmed, isCorrect: true, autoSkipped: false, feedback: [{letter, status: "green"}]});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}}});
  });
});
