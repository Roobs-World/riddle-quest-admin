import {describe, expect, it, jest} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

describe("Race Session confirmed progress", () => {
  it.each(["elapsed", "sample", "before-start"])("rejects contradictory initial %s clocks without saving an owned run", async kind => {
    /** Initial transport response has not established run ownership. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Individually valid fields still have to describe one actual server clock. */
    const run = {...await fixture(), startsAtMs: 1000, serverNowMs: 2000, wallElapsedMs: 1000, adjustedElapsedMs: 1000};
    if (kind === "elapsed") {run.wallElapsedMs = 5000; run.adjustedElapsedMs = 5000;}
    else run.serverNowMs = kind === "sample" ? 1500 : 500;
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null, stage: "categories"});
    expect(h.saved).toEqual([]);
  });
  it.each([false, true])("rejects a changed elapsed clock on recovery, omitted-start=%s, preserving the draft", async omitStart => {
    /** Existing owned run has a recoverable input draft. */
    const h = await racing(); h.session.input("text", "pi");
    /** Recovery must not consume the current question's typed letters or receipt clock. */
    const before = h.session.getSnapshot(); h.session.retry();
    /** Individually valid but contradictory clock metadata from the authority transport. */
    const reply = await h.authority.resumeRace(h.run.runId);
    reply.run.wallElapsedMs += 10000; reply.run.adjustedElapsedMs += 10000;
    if (omitStart) delete reply.run.startsAtMs;
    h.respond("raceResume", reply);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run,
      currentLetters: before.currentLetters, receivedAtMs: before.receivedAtMs});
    h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: before.currentLetters});
  });
  it.each(["prepared", "scheduled", "active", "completed", "timed_out", "abandoned"] as const)("rejects a %s snapshot with the wrong question presence", async status => {
    /** Original category selection stays recoverable instead of entering a blank screen. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Live phases require a question; terminal phases cannot retain one. */
    const run = await fixture(); run.status = status;
    if (["prepared", "scheduled", "active"].includes(status)) run.currentRiddle = null;
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null, stage: "categories"});
    expect(h.saved).toEqual([]);
  });
  it.each(["score", "penalty", "position", "reveals", "guesses", "prepared", "scheduled"])("rolls back a paid receipt that regresses confirmed %s and recovers without charging again", async kind => {
    /** Actual authority records progress independently of outgoing transport corruption. */
    const h = await racing(); h.session.input("text", "piano"); h.session.submit();
    /** First solved question gives the later snapshot a nonzero confirmed score. */
    const solved = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "first-solve"});
    h.respond("raceGuess", solved); h.session.hint();
    /** Confirmed hint and optional wrong attempt pin progress on the second question. */
    const hint = await h.authority.requestRaceHint({runId: h.run.runId, riddleId: solved.run.currentRiddle!.riddleId, requestId: "first-hint"});
    h.respond("raceHint", hint); h.session.input("text", kind === "guesses" ? "zzzz" : "zi");
    if (kind === "guesses") {
      h.session.submit();
      h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: hint.run.currentRiddle!.riddleId, guess: "czzzz", requestId: "wrong-guess"}));
    }
    /** Original confirmed input and timing remain owned until semantic validation succeeds. */
    const original = h.session.getSnapshot(); h.session.hint();
    /** The second paid action is already applied by the genuine authority. */
    const response = await h.authority.requestRaceHint({runId: h.run.runId, riddleId: hint.run.currentRiddle!.riddleId, requestId: "second-hint"});
    if (kind === "score") response.run.correctCount = 0;
    if (kind === "penalty") response.run.totalPenaltyMs = 0;
    if (kind === "position") response.run.currentRiddle = structuredClone(h.run.currentRiddle);
    if (kind === "reveals") response.run.currentRiddle!.revealedLetters = response.run.currentRiddle!.revealedLetters.filter(letter => letter.index !== 0);
    if (kind === "guesses") {response.run.currentRiddle!.guessesUsed = 0; response.run.currentRiddle!.guessesRemaining = 5;}
    if (kind === "prepared" || kind === "scheduled") response.run.status = kind;
    h.respond("raceHint", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: original.run, currentLetters: original.currentLetters, raceGuesses: original.raceGuesses});
    h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, totalPenaltyMs: 30000, currentRiddle: {position: 1, revealedLetters: [{index: 0, letter: "c"}, {index: 1, letter: "l"}]}}});
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(2);
    expect(h.commands.filter(command => command.type === "game:resumeRace")).toHaveLength(1);
  });
  it("accepts another tab's prepared-to-active transition and later terminal completion", async () => {
    /** A caller may reconnect after skipping the local countdown entirely. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Shared authority keeps the prepared deck stable across readiness and scoring. */
    const authority = createFakeRaceServices(), prepared = await fixture(true, authority);
    h.respond("raceStart", {run: prepared}); h.reject("raceReady", "lost-ready"); h.session.retry();
    /** Current server status may already be active when the readiness retry arrives. */
    const active = structuredClone(prepared); active.status = "active"; active.startsAtMs = active.serverNowMs;
    h.respond("raceReady", {run: active}); h.advance(4000);
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing"});
    h.session.retry();
    /** A coherent terminal authority snapshot needs no editable question. */
    const completed = {...active, status: "completed" as const, correctCount: 10, currentRiddle: null};
    h.respond("raceResume", {run: completed});
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "result", run: {status: "completed"}});
    expect(h.last().type).toBe("game:getRaceOutcome");
  });
  it("projects expired preparation without an editable question in the injected authority", async () => {
    /** Expiry must advance the fake authority by wall time, rather than patching its public view. */
    const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
    try {
      /** Actual preparation records an immutable deadline. */
      const authority = createFakeRaceServices(), prepared = await fixture(true, authority);
      clock.mockReturnValue(prepared.preparationExpiresAtMs!);
      expect((await authority.resumeRace(prepared.runId)).run).toMatchObject({status: "abandoned", currentRiddle: null, correctCount: 0, totalPenaltyMs: 0});
    } finally {clock.mockRestore();}
  });
});
