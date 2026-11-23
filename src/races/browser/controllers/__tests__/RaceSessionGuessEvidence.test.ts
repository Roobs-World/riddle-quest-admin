import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support.ts";

describe("Race Session guess progression evidence", () => {
  it.each(["missing-event", "wrong-question", "unchanged-score", "contradictory-flags"])("rejects a correct acknowledgement with %s", async corruption => {
    /** Genuine authority and the optimistic successor belong to the same original submission. */
    const h = await racing();h.session.input("text", "piano");
    /** The original attempt survives a semantically malformed acknowledgement. */
    const before = h.session.getSnapshot();h.session.submit();h.session.input("text", "clo");
    /** Cloning keeps deliberate transport corruption separate from committed authority. */
    const response = structuredClone(await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "accepted-answer"}));
    if (corruption === "missing-event") response.run.events = [];
    if (corruption === "wrong-question") response.run.events[0].riddlePosition = 1;
    if (corruption === "unchanged-score") {response.run.correctCount = 0;response.run.events[0].correctCount = 0;}
    if (corruption === "contradictory-flags") response.autoSkipped = true;
    h.respond("raceGuess", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run, currentLetters: [..."piano"]});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}}, currentLetters: ["c", "l", "o", "", ""]});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
  });
  it.each(["missing-charge", "unchanged-score"])("rejects automatic skip acknowledgement with %s", async corruption => {
    /** Four real incorrect submissions leave exactly one attempt before an automatic skip. */
    const h = await racing();
    for (let index = 0; index < 4; index++) {
      h.session.input("text", "zzzzz");h.session.submit();
      h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: `wrong-${index}`}));
    }
    /** The fifth submission has an owned, recoverable original question. */
    const before = h.session.getSnapshot();h.session.input("text", "zzzzz");h.session.submit();
    /** Real authority has already advanced and charged exactly once. */
    const response = structuredClone(await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "automatic-skip"}));
    if (corruption === "missing-charge") {response.run.totalPenaltyMs = 0;response.run.adjustedElapsedMs = response.run.wallElapsedMs;response.run.events = [];}
    else {response.run.correctCount = 0;response.run.events[0].correctCount = 0;}
    h.respond("raceGuess", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run, currentLetters: [..."zzzzz"]});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, totalPenaltyMs: 45000, currentRiddle: {position: 1}}});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(5);
  });
  it("accepts correct evidence followed by another tab's later skip", async () => {
    /** New canonical progress may legitimately surpass the locally predicted successor. */
    const h = await racing();h.session.input("text", "piano");h.session.submit();
    /** The submitted answer's event remains present before later concurrency. */
    const response = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "answer-before-other-tab"});
    await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: response.run.currentRiddle!.riddleId, requestId: "later-tab-skip"});
    response.run = (await h.authority.resumeRace(h.run.runId)).run;
    h.respond("raceGuess", response);
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 2, currentRiddle: {position: 2}}});
  });
  it.each(["correct", "automatic-skip"])("accepts %s evidence that clears the final question", async ending => {
    /** Real canonical skips establish nine clears and immutable prior paid history. */
    const h = await racing();
    for (let index = 0; index < 9; index++) {
      /** Canonical current question identifies each setup mutation independently of client rendering. */
      const active = (await h.authority.resumeRace(h.run.runId)).run;
      await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: active.currentRiddle!.riddleId, requestId: `setup-skip-${index}`});
    }
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    /** Final scoring retains the full canonical prefix before terminal projection. */
    const run = h.session.getSnapshot().run!;
    expect(run).toMatchObject({correctCount: 9, currentRiddle: {position: 9}});
    /** Wrong attempts trigger a charged automatic clear only on the fifth submission. */
    const guess = ending === "correct" ? run.currentRiddle!.evaluation!.answer : "z".repeat(run.currentRiddle!.answerLength);
    for (let index = 0; index < (ending === "correct" ? 1 : 5); index++) {
      h.session.input("text", guess);h.session.submit();
      h.respond("raceGuess", await h.authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess, requestId: `final-guess-${index}`}));
    }
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "result", pending: "raceOutcome", run: {correctCount: 10, status: "completed", currentRiddle: null}});
  });

});
