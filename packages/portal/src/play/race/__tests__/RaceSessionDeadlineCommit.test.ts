import {describe, expect, it} from "@jest/globals";
import type {RaceRunView} from "@riddle-quest/core/race";
import {catalog, fixture, harness} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {projectRaceOutcome} from "../logic/racePresentation";

/** Competitive wire fixture pins a ghost later than the maximum adjusted deadline. */
const competitive = (run: RaceRunView): RaceRunView => ({...run, role: "challenger", challengeId: "deadline-challenge",
  opponent: {displayName: "Nova", adjustedFinishMs: 360000, events: []}});

describe("Race final guess response loss at the local deadline", () => {
  it.each(["timeout", "rejected", "malformed"] as const)("reconciles a committed finish after %s without repeating the guess", async failure => {
    /** Independent fake authority retains the complete committed recording. */
    const authority = createFakeRaceServices(), h = {...harness(), authority};
    h.respond("raceCategories", await catalog()); h.session.begin("mixed", "deadline-challenge");
    h.respond("raceStart", {run: competitive(await fixture(false, authority))}); h.advance(3480);
    for (let position = 0; position < 9; position++) {
      /** Each command uses the accepted current question and original receipt. */
      const run = h.session.getSnapshot().run!, guess = run.currentRiddle!.evaluation!.answer;
      h.session.input("text", guess); h.session.submit();
      /** Mutation data commits independently before the competitive wire fixture is returned. */
      const result = await h.authority.submitRaceGuess({runId: run.runId,
        riddleId: run.currentRiddle!.riddleId, guess, requestId: h.last().requestId!});
      h.respond("raceGuess", {...result, run: competitive(result.run)});
    }
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 9}, stage: "racing"});
    h.advance(295000);
    /** Final guess commits before the client receives any acknowledgment. */
    const run = h.session.getSnapshot().run!, guess = run.currentRiddle!.evaluation!.answer;
    h.session.input("text", guess); h.session.submit();
    /** Saved envelope proves late and duplicate delivery belongs to this original command. */
    const command = h.last(), committed = await h.authority.submitRaceGuess({runId: run.runId,
      riddleId: run.currentRiddle!.riddleId, guess, requestId: command.requestId!});
    if (failure === "timeout") h.advance(30000);
    else {
      if (failure === "rejected") h.reject("raceGuess", "lost response");
      else h.respond("raceGuess", {});
      h.advance(6000);
    }
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceOutcome", stage: "result"});
    expect(h.last().type).toBe("game:getRaceOutcome");
    /** Canonical outcome supersedes a local timeout projection with the committed recording. */
    const outcome = projectRaceOutcome(competitive(committed.run), committed.run.adjustedElapsedMs)!;
    h.respond("raceOutcome", outcome);
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, stage: "result",
      requiresRunRefresh: false, outcome: {result: "player_win", correctCount: 10}});
    h.respond("raceGuess", {...committed, run: competitive(committed.run)}, command); h.session.tick();
    expect(h.commands.filter(message => message.type === "game:submitRaceGuess")).toHaveLength(10);
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
});
