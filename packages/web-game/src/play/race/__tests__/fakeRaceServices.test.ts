import {describe, expect, it, jest} from "@jest/globals";
import {RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS, RaceRunResponseSchema} from "@riddle-quest/core/race";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {projectInstantRaceHint} from "../logic/racePresentation";

/** Deterministic answers corresponding to the fake service’s race deck. */
const answers = ["piano", "clock", "towel", "bottle", "stamp", "needle", "name", "comb", "water", "book"];

describe("createFakeRaceServices", () => {
  it("clears automatic skips once, including the tenth question, with production-shaped events", async () => {
    /** Every exhausted attempt counts as a cleared question just as the authoritative engine does. */
    const services = createFakeRaceServices();
    /** Mutable run follows the public response after every recorded attempt. */
    let run = (await services.startRace({locale: "en", categoryId: "mixed", requestId: "automatic-skip-start"})).run;
    for (let position = 0; position < 10; position++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        /** Each new attempt has its own idempotent mutation receipt. */
        const request = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: `automatic-skip-${position}-${attempt}`, guess: "x".repeat(run.currentRiddle!.answerLength)};
        /** Cached replay cannot add another penalty or cleared question. */
        const guessed = await services.submitRaceGuess(request);
        await expect(services.submitRaceGuess(request)).resolves.toEqual(guessed);
        expect(guessed.autoSkipped).toBe(attempt === 4);
        expect(guessed.run.correctCount).toBe(position + (attempt === 4 ? 1 : 0));
        run = guessed.run;
      }
      expect(run.events.at(-1)).toMatchObject({type: "skip", riddlePosition: position, correctCount: position + 1, penaltyAddedMs: 45000});
    }
    expect(run).toMatchObject({status: "completed", currentRiddle: null, correctCount: 10, totalPenaltyMs: 450000});
    expect(run.events).toHaveLength(10);
    await expect(services.getRaceOutcome(run.runId)).resolves.toMatchObject({result: "recorded", correctCount: 10, skipPenaltyMs: 450000, publishable: true, rematchEligible: false});
  });
  it.each(["prepared", "scheduled", "abandoned", "completed"])("rejects new play mutations on a %s run without charging", async status => {
    /** Controlled time prevents a scheduled countdown from accidentally completing in the test. */
    const clock = jest.spyOn(Date, "now").mockReturnValue(100000);
    try {
      /** Independent authority-owned run for each lifecycle status. */
      const services = createFakeRaceServices();
      /** Prepared runs retain their question but cannot be mutated before readiness. */
      let run = (await services.startRace({locale: "en", categoryId: "mixed", requestId: "inactive-start", prepare: status !== "completed"})).run;
      if (status === "scheduled") run = (await services.readyRace({runId: run.runId, requestId: "inactive-ready"})).run;
      if (status === "abandoned") run = (await services.abandonRace({runId: run.runId, requestId: "inactive-quit"})).run;
      if (status === "completed") for (const [index, guess] of answers.entries()) run = (await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess, requestId: `inactive-guess-${index}`})).run;
      expect(run.status).toBe(status);
      await expect(services.submitRaceGuess({runId: run.runId, riddleId: "fake-race-1", guess: "piano", requestId: "invalid-guess"})).rejects.toThrow("no longer active");
      await expect(services.requestRaceHint({runId: run.runId, riddleId: "fake-race-1", requestId: "invalid-hint"})).rejects.toThrow("no longer active");
      await expect(services.skipRaceRiddle({runId: run.runId, riddleId: "fake-race-1", requestId: "invalid-skip"})).rejects.toThrow("no longer active");
      expect((await services.resumeRace(run.runId)).run).toMatchObject({status, totalPenaltyMs: 0, correctCount: status === "completed" ? 10 : 0});
    } finally {clock.mockRestore();}
  });
  it("rejects stale question mutations after a skip while preserving the original receipt replay", async () => {
    /** Stale commands cannot mutate the successor merely because they refer to the same run. */
    const services = createFakeRaceServices();
    /** Initial authority-issued active question. */
    const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "stale-question-start"});
    /** Original skip receipt is still valid for replay after advancement. */
    const request = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "stale-question-skip"};
    /** Exactly one paid advancement is recorded. */
    const skipped = await services.skipRaceRiddle(request);
    await expect(services.skipRaceRiddle(request)).resolves.toEqual(skipped);
    await expect(services.submitRaceGuess({...request, guess: "piano", requestId: "new-stale-guess"})).rejects.toThrow("riddle is no longer active");
    await expect(services.requestRaceHint({...request, requestId: "new-stale-hint"})).rejects.toThrow("riddle is no longer active");
    await expect(services.skipRaceRiddle({...request, requestId: "new-stale-skip"})).rejects.toThrow("riddle is no longer active");
    expect((await services.resumeRace(run.runId)).run).toMatchObject({correctCount: 1, totalPenaltyMs: 45000, currentRiddle: {position: 1}});
  });
  it.each(["ghost", "timeout"].flatMap(ending => ["hint", "skip", "automatic"].map(action => ({ending, action}))))("returns a terminal $action view, freezes its clock and charges once at the $ending boundary", async ({ending, action}) => {
    /** Controlled server time proves deadline behavior without wall-clock races. */
    const clock = jest.spyOn(Date, "now").mockReturnValue(100000);
    try {
      /** Published creator recording gives the challenger a genuine authority-owned opponent. */
      const services = createFakeRaceServices();
      /** Creator time can exceed the challenger limit because creators remain uncapped. */
      const creator = await services.startRace({locale: "en", categoryId: "mixed", requestId: "creator-start"});
      for (const [index, guess] of answers.entries()) {
        clock.mockReturnValue(100000 + (index + 1) * 1000);
        if (ending === "timeout" && index === 9) clock.mockReturnValue(100000 + creator.run.rules.maxAdjustedTimeMs + 60000);
        await services.submitRaceGuess({runId: creator.run.runId, riddleId: `fake-race-${index + 1}`, guess, requestId: `creator-guess-${index}`});
      }
      /** Immutable recording is the same one returned by the normal publication contract. */
      const published = await services.publishRace({runId: creator.run.runId, requestId: "creator-publish"});
      /** Challenger is active before requesting the penalty that ends its run. */
      const {run} = await services.startRace({locale: "en", challengeId: published.challengeId, requestId: "challenger-start", includeEvaluation: true});
      if (ending === "timeout") clock.mockReturnValue(run.serverNowMs + run.rules.maxAdjustedTimeMs - 10000);
      if (action === "automatic") for (let attempt = 0; attempt < 4; attempt++) await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "xxxxx", requestId: `wrong-${attempt}`});
      /** Idempotency identity belongs to the original action that crosses the boundary. */
      const request = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "terminal-action", guess: "xxxxx"};
      /** The same public mutation is replayed after terminal completion. */
      const apply = () => action === "hint" ? services.requestRaceHint(request) : action === "skip" ? services.skipRaceRiddle(request) : services.submitRaceGuess(request);
      /** Production-shaped terminal response retains the recorded event and omits its active question. */
      const hinted = await apply();
      expect(hinted.run).toMatchObject({status: ending === "ghost" ? "completed" : "timed_out", currentRiddle: null, totalPenaltyMs: action === "hint" ? 15000 : 45000, correctCount: action === "hint" ? 0 : 1});
      expect(hinted.run.events).toHaveLength(1);
      clock.mockReturnValue(Date.now() + 60000);
      expect((await services.resumeRace(run.runId)).run.adjustedElapsedMs).toBe(hinted.run.adjustedElapsedMs);
      await expect(apply()).resolves.toEqual(hinted);
      expect(await services.getRaceOutcome(run.runId)).toMatchObject({result: ending === "ghost" ? "ghost_win" : "timed_out", hintPenaltyMs: action === "hint" ? 15000 : 0, skipPenaltyMs: action === "hint" ? 0 : 45000,
        publishable: false, rematchEligible: ending === "ghost"});
    } finally {clock.mockRestore();}
  });
  it("allows quitting prepared and scheduled runs without creating a result", async () => {
    for (const schedule of [false, true]) {
      /** Independent race adapter for each pre-start status. */
      const services = createFakeRaceServices();
      /** Complete prepared deck before solving time begins. */
      const prepared = await services.startRace({locale: "en", categoryId: "mixed", requestId: "prepare-quit", prepare: true});
      if (schedule) await services.readyRace({runId: prepared.run.runId, requestId: "ready-quit"});
      /** Correlated quit is safe to retry and never counts as a race result. */
      const request = {runId: prepared.run.runId, requestId: "abandon-prestart"};
      /** Authoritative null-result confirmation for a pre-start exit. */
      const abandoned = await services.abandonRace(request);
      expect(abandoned).toMatchObject({run: {status: "abandoned", wallElapsedMs: 0, currentRiddle: null}, result: null});
      await expect(services.abandonRace(request)).resolves.toEqual(abandoned);
    }
  });
  it("accepts an earlier race-start response without preloaded hint fields", async () => {
    /** Local authoritative race harness. */
    const services = createFakeRaceServices();
    /** Evaluation-enabled start response. */
    const response = await services.startRace({
      locale: "en", categoryId: "mixed", requestId: "legacy-start-1", includeEvaluation: true,
    });
    /** Earlier server response shape without a preselected hint. */
    const deployedShape = {
      run: {
        ...response.run,
        preloadedRiddles: response.run.preloadedRiddles?.map(({hint: _hint, ...riddle}) => riddle),
      },
    };
    /** Validated response from the earlier server. */
    const parsed = RaceRunResponseSchema.parse(deployedShape);
    expect(parsed.run.currentRiddle?.riddleId).toBe(response.run.currentRiddle?.riddleId);
    expect(projectInstantRaceHint(parsed.run)?.currentRiddle?.revealedLetters).toEqual([{index: 0, letter: "p"}]);
  });

  it("fails only the requested number of background outcome attempts", async () => {
    /** Existing global location descriptor restored after configuring the browser-only harness seam. */
    const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {search: "?raceOutcomeFailures=1"},
    });
    /** Service captures the bounded one-shot failure count at construction. */
    const services = createFakeRaceServices();
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation);
    else Reflect.deleteProperty(globalThis, "location");

    await expect(services.getRaceOutcome("missing-run")).rejects.toThrow("Temporary outcome service failure");
    await expect(services.getRaceOutcome("missing-run")).rejects.toThrow("Race run not found");
  });

  it("lists categories and starts and resumes an authoritative run", async () => {
    /** Isolated fake host service instance for the test. */
    const services = createFakeRaceServices();
    /** Category response exposed to the multiplayer lobby. */
    const listing = await services.listRaceCategories("en");
    expect(listing.categories).toHaveLength(6);
    expect(listing.categories.every((category) => category.availableRiddleCount === 30)).toBe(true);

    /** Newly created authoritative harness run. */
    const started = await services.startRace({locale: "en", categoryId: "science", requestId: "request-start-1"});
    expect(started.run).toMatchObject({status: "active", categoryId: "science", correctCount: 0});
    await expect(services.resumeRace(started.run.runId)).resolves.toMatchObject({run: {runId: started.run.runId}});
    await expect(services.listRaceInbox()).resolves.toMatchObject({items: [{opponentDisplayName: "Nova"}]});
  });

  it("preloads every question and answer when a Race run opts into local evaluation", async () => {
    /** The services used by this regression scenario. */
    const services = createFakeRaceServices();
    /** The legacy used by this regression scenario. */
    const legacy = await services.startRace({locale: "en", categoryId: "mixed", requestId: "legacy"});
    expect(legacy.run.currentRiddle).not.toHaveProperty("evaluation");
    /** The destructured result used by this regression scenario. */
    const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "preview",
      includeEvaluation: true});
    expect(run.currentRiddle?.evaluation).toEqual({answer: "piano", locale: "en"});
    expect(run.preloadedRiddles).toHaveLength(15);
    expect(run.preloadedRiddles?.[1]).toMatchObject({text: expect.any(String), evaluation: {answer: "clock", locale: "en"}});
    /** The advanced used by this regression scenario. */
    const advanced = await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId,
      requestId: "answer-1", guess: "piano"});
    expect(advanced.run.currentRiddle?.evaluation).toEqual({answer: "clock", locale: "en"});
  });
  it("deduplicates concurrent starts and replays the latest prepared run state", async () => {
    /** Independent authority adapter owns these start receipts. */
    const services = createFakeRaceServices();
    /** Both concurrent deliveries represent one player start intent. */
    const request = {locale: "en" as const, categoryId: "history" as const, requestId: "same-start-receipt", prepare: true, includeEvaluation: true};
    /** Duplicate transport deliveries cannot create separate runs. */
    const [first, duplicate] = await Promise.all([services.startRace(request), services.startRace(request)]);
    expect(first.run.runId).toBe(duplicate.run.runId);
    expect(first.run.status).toBe("prepared");
    await services.readyRace({runId: first.run.runId, requestId: "ready-start-receipt", includeEvaluation: true});
    /** Start replay returns the original run's scheduled state, as server resume does. */
    const replay = await services.startRace(request);
    expect(replay.run).toMatchObject({runId: first.run.runId, status: "scheduled", categoryId: "history"});
    /** A deliberately new intent creates a separate prepared race. */
    const fresh = await services.startRace({...request, requestId: "new-start-receipt"});
    expect(fresh.run.runId).not.toBe(first.run.runId);
  });

  it("applies hints and skips idempotently with authoritative penalties", async () => {
    /** Isolated fake host service instance for the test. */
    const services = createFakeRaceServices();
    /** Run used to exercise hint, guess, and skip mutations. */
    const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "request-start-2"});
    /** Idempotency request shared by repeated hint calls. */
    const hintRequest = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "request-hint-1"};
    /** First authoritative hint response. */
    const hinted = await services.requestRaceHint(hintRequest);
    await expect(services.requestRaceHint(hintRequest)).resolves.toEqual(hinted);
    expect(hinted.run.totalPenaltyMs).toBe(RACE_HINT_PENALTY_MS);
    expect(hinted.revealedLetter).toBe("p");
    /** Distinct hint request for the same riddle. */
    const secondHint = await services.requestRaceHint({...hintRequest, requestId: "request-hint-2"});
    expect(secondHint).toMatchObject({revealedLetter: "i", index: 1});
    expect(secondHint.run.currentRiddle?.hintAvailable).toBe(true);
    expect(secondHint.run.totalPenaltyMs).toBe(2 * RACE_HINT_PENALTY_MS);

    /** Incorrect guess before a later manual skip. */
    const guessed = await services.submitRaceGuess({
      runId: run.runId,
      riddleId: run.currentRiddle!.riddleId,
      requestId: "request-guess-1",
      guess: "xxxxx",
    });
    expect(guessed.isCorrect).toBe(false);
    /** Authoritative skip response with the published time penalty. */
    const skipped = await services.skipRaceRiddle({
      runId: run.runId,
      riddleId: run.currentRiddle!.riddleId,
      requestId: "request-skip-1",
    });
    expect(skipped.penaltyAddedMs).toBe(RACE_SKIP_PENALTY_MS);
    expect(skipped.run.totalPenaltyMs).toBe(2 * RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS);
    expect(skipped.run.correctCount).toBe(1);
    expect(skipped.run.currentRiddle?.position).toBe(1);
  });

  it("completes, publishes, reloads, and scores a creator challenge", async () => {
    /** Isolated fake host service instance for the test. */
    const services = createFakeRaceServices();
    /** Mutable authoritative view advanced after every correct answer. */
    let run = (await services.startRace({locale: "en", categoryId: "history", requestId: "request-start-3"})).run;
    for (const [index, answer] of answers.entries()) {
      /** Correct response for the current deterministic riddle. */
      const response = await services.submitRaceGuess({
        runId: run.runId,
        riddleId: run.currentRiddle!.riddleId,
        requestId: `request-correct-${index}`,
        guess: answer,
      });
      run = response.run;
    }
    expect(run).toMatchObject({status: "completed", correctCount: 10, currentRiddle: null});

    /** Published challenge generated from the completed creator run. */
    const publication = await services.publishRace({runId: run.runId, requestId: "request-publish-1"});
    await expect(services.publishRace({runId: run.runId, requestId: "request-publish-1"})).resolves.toEqual(
      publication,
    );
    await expect(services.getRaceChallenge(publication.challengeId, "en")).resolves.toEqual(publication.preview);
    await expect(services.getRaceChallenge(publication.challengeId, "ja")).rejects.toThrow(
      "RaceTo10.ERROR_LOCALE_MISMATCH",
    );
    await expect(services.getRaceOutcome(run.runId)).resolves.toMatchObject({
      result: "recorded",
      correctCount: 10,
      publishable: true,
    });
  });

  it("abandons an active run idempotently and rejects invalid operations", async () => {
    /** Isolated fake host service instance for the test. */
    const services = createFakeRaceServices();
    /** Active run abandoned by the test. */
    const {run} = await services.startRace({locale: "en", categoryId: "film", requestId: "request-start-4"});
    /** Reusable idempotent abandonment request. */
    const abandonRequest = {runId: run.runId, requestId: "request-abandon-1"};
    /** First abandonment response cached by request identifier. */
    const abandoned = await services.abandonRace(abandonRequest);
    expect(abandoned).toMatchObject({run: {status: "abandoned"}, result: null});
    await expect(services.abandonRace(abandonRequest)).resolves.toEqual(abandoned);
    await expect(services.resumeRace("missing-run")).rejects.toThrow("Race run not found");
    await expect(services.getRaceChallenge("missing-challenge", "en")).rejects.toThrow("Race challenge not found");
  });
});
