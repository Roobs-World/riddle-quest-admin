import {expect, it} from "@jest/globals";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Delayed deliveries of one receipt must share the original mutation, even across question advancement. */
it.each(["wrong", "correct", "exhausted", "skip"])("deduplicates overlapping %s guess deliveries", async scenario => {
  /** Save ambient descriptors so the injected browser adapter cannot escape this example. */
  const descriptors = {window: Object.getOwnPropertyDescriptor(globalThis, "window"), location: Object.getOwnPropertyDescriptor(globalThis, "location")};
  /** Each delayed request is released explicitly, avoiding wall-clock timing in the reproduction. */
  const timers: Array<() => void> = [];
  Object.defineProperty(globalThis, "window", {configurable: true, value: {setTimeout: (resolve: () => void) => {timers.push(resolve); return timers.length;}}});
  Object.defineProperty(globalThis, "location", {configurable: true, value: {search: ""}});
  try {
    /** Public authority starts on a deterministic five-slot question. */
    const services = createFakeRaceServices();
    /** Canonical initial question identity stays fixed for both duplicate requests. */
    const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "delayed-start"});
    if (scenario === "exhausted") for (let attempt = 0; attempt < 4; attempt++) {
      await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "wrong", requestId: `previous-${attempt}`});
    }
    Object.defineProperty(globalThis, "location", {configurable: true, value: {search: "?raceGuessDelayMs=100&raceSkipDelayMs=100"}});
    /** Exact mutation receipt delivered twice before either delayed response completes. */
    const request = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: scenario === "correct" ? "piano" : "wrong", requestId: "overlap-guess"};
    /** Capture both outcomes before resolving timers, including expected baseline rejection. */
    const responses = scenario === "skip"
      ? Promise.allSettled([services.skipRaceRiddle(request), services.skipRaceRiddle(request)])
      : Promise.allSettled([services.submitRaceGuess(request), services.submitRaceGuess(request)]);
    expect(timers).toHaveLength(2);
    timers.forEach(resolve => resolve());
    /** Both callers must receive the same original authority response. */
    const results = await responses;
    expect(results.every(result => result.status === "fulfilled")).toBe(true);
    expect(results[1]).toEqual(results[0]);
    /** Canonical state proves that no extra attempt, cleared question or paid skip was recorded. */
    const final = (await services.resumeRace(run.runId)).run;
    expect(final.correctCount).toBe(scenario === "wrong" ? 0 : 1);
    expect(final.currentRiddle!.guessesUsed).toBe(scenario === "wrong" ? 1 : 0);
    expect(final.totalPenaltyMs).toBe(["exhausted", "skip"].includes(scenario) ? run.rules.skipPenaltyMs : 0);
  } finally {
    for (const key of ["window", "location"] as const) {
      /** Restore the exact original global presence and accessor semantics. */
      const descriptor = descriptors[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
