import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support.ts";

describe("Race Session pending checkpoint reference isolation", () => {
  it.each(["guess-run", "guess-history", "hint-run", "hint-history", "skip-run", "skip-history"])("restores the captured original after public mutation: %s", async kind => {
    /** A real wrong guess establishes editable input and nested historical feedback. */
    const h = await racing();h.session.input("text", "zzzzz");h.session.submit();
    h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "initial-wrong"}));
    h.session.input("text", kind.startsWith("guess") ? "piano" : "pi");
    /** The entire intended rollback is captured before any rendering reference is changed. */
    const original = structuredClone(h.session.getSnapshot());
    /** Consumers can retain prior public references even after optimistic rendering advances. */
    const publicSnapshot = h.session.getSnapshot();
    if (kind.startsWith("guess")) h.session.submit();
    else if (kind.startsWith("hint")) h.session.hint();
    else h.session.skip();
    if (kind.endsWith("run")) publicSnapshot.run!.preloadedRiddles![1].text = "A mutated public clue";
    else {publicSnapshot.raceGuesses[0].guess[0] = "x";publicSnapshot.raceGuesses[0].feedback[0] = "green";}
    /** Transport failure must recover what was captured rather than the consumer's later edits. */
    const operation = kind.startsWith("guess") ? "raceGuess" : kind.startsWith("hint") ? "raceHint" : "raceSkip";
    h.reject(operation, "Temporary transport failure");
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_GENERIC", run: original.run, raceGuesses: original.raceGuesses, currentLetters: original.currentLetters});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: original.raceGuesses, currentLetters: original.currentLetters});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(kind.startsWith("guess") ? 2 : 1);
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(kind.startsWith("hint") ? 1 : 0);
    expect(h.commands.filter(command => command.type === "game:skipRaceRiddle")).toHaveLength(kind.startsWith("skip") ? 1 : 0);
  });
  it("confirms original submitted scoring despite a later public answer mutation", async () => {
    /** A pending correct answer owns its evaluation independently of retained public references. */
    const h = await racing();h.session.input("text", "piano");
    /** The renderer's reference can outlive its original question. */
    const publicRun = h.session.getSnapshot().run!;h.session.submit();h.session.input("text", "clo");
    publicRun.currentRiddle!.evaluation!.answer = "ziano";
    h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "isolated-correct"}));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}}, currentLetters: ["c", "l", "o", "", ""]});
  });
});
