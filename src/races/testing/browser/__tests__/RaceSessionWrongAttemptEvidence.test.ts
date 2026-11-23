import {describe, expect, it} from "@jest/globals";
import {catalog, harness, racing} from "../../../browser/controllers/__tests__/raceSession.support.ts";
import {createFakeRaceServices} from "../fakeRaceServices";

describe("Race Session incorrect guess attempt evidence", () => {
  it.each(["first", "later", "legacy"])("rejects unchanged attempt count for a %s wrong submission", async kind => {
    /** Modern runs project feedback; legacy runs still own their submitted question. */
    const authority = createFakeRaceServices();
    /** Canonical authority remains separate from the deliberately stale transport snapshot. */
    const {run} = await authority.startRace({locale: "en", categoryId: "mixed", requestId: "attempt-start", includeEvaluation: kind !== "legacy"});
    /** Public session preserves recovery without automatically repeating a mutation. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");h.respond("raceStart", {run});h.advance(3480);
    if (kind === "later") {
      h.session.input("text", "zzzzz");h.session.submit();
      h.respond("raceGuess", await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "prior-wrong"}));
      expect(h.session.getSnapshot()).toMatchObject({error: null, run: {currentRiddle: {guessesUsed: 1}}});
    }
    /** The confirmed attempt count is a lower bound for its successful successor receipt. */
    const original = h.session.getSnapshot().run!;
    h.session.input("text", "zzzzz");h.session.submit();
    /** A real successful wrong guess owns valid feedback but cannot reuse its earlier budget. */
    const bad = structuredClone(await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "accepted-wrong"}));
    bad.run.currentRiddle!.guessesUsed = original.currentRiddle!.guessesUsed;
    bad.run.currentRiddle!.guessesRemaining = original.currentRiddle!.guessesRemaining;
    h.respond("raceGuess", bad);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [..."zzzzz"], run: {currentRiddle: {guessesUsed: kind === "later" ? 1 : 0}}});
    h.session.retry();h.respond("raceResume", await authority.resumeRace(run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {currentRiddle: {guessesUsed: kind === "later" ? 2 : 1}}});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(kind === "later" ? 2 : 1);
  });
  it.each(["another-wrong", "another-tab-clear"])("accepts wrong confirmation containing %s", async concurrency => {
    /** Authority may include later progress from another browser owner. */
    const h = await racing();h.session.input("text", "zzzzz");h.session.submit();
    /** The accepted wrong answer is immutable even when its accompanying view advances. */
    const response = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "original-wrong"});
    if (concurrency === "another-wrong") await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "concurrent-wrong"});
    else await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "concurrent-clear"});
    response.run = (await h.authority.resumeRace(h.run.runId)).run;
    h.respond("raceGuess", response);
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: concurrency === "another-wrong" ? {currentRiddle: {position: 0, guessesUsed: 2}} : {correctCount: 1, currentRiddle: {position: 1, guessesUsed: 0}}});
  });
});
