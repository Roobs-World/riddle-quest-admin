import {describe, expect, it} from "@jest/globals";
import {RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS, RaceRunResponseSchema} from "@qwordly/core/race";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {projectInstantRaceHint} from "../logic/racePresentation";

/** Deterministic answers corresponding to the fake service’s race deck. */
const answers = ["piano", "clock", "towel", "bottle", "stamp", "needle", "name", "comb", "water", "book"];

describe("createFakeRaceServices", () => {
  it("accepts an earlier race-start response without preloaded hint fields", async () => {
    const services = createFakeRaceServices();
    const response = await services.startRace({
      locale: "en", categoryId: "mixed", requestId: "legacy-start-1", includeEvaluation: true,
    });
    const deployedShape = {
      run: {
        ...response.run,
        preloadedRiddles: response.run.preloadedRiddles?.map(({hint: _hint, ...riddle}) => riddle),
      },
    };
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
    expect(skipped.run.totalPenaltyMs).toBe(RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS);
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
