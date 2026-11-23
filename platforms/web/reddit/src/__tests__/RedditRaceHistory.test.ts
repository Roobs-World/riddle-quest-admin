import {expect, it, jest, afterEach} from "@jest/globals";
import {createRedditHostServices} from "../RedditHostServices";
import {createFakeRaceServices} from "../../../../../src/races/testing/browser/fakeRaceServices";

/** Fetch replacement is confined to each target-adapter contract scenario. */
const originalFetch = global.fetch;
afterEach(() => {global.fetch = originalFetch;});

/** Reddit requests canonical history through its own same-origin proxy and accepts legacy responses. */
it.each([false, true])("negotiates confirmed race guesses through Reddit, history=%s", async history => {
  /** Real authority fixture establishes a committed wrong answer and canonical consumed count. */
  const authority = createFakeRaceServices();
  /** Evaluation-enabled run keeps the same content contract used by every supported race target. */
  const started = await authority.startRace({locale: "en", categoryId: "mixed", prepare: false, includeEvaluation: true, requestId: "reddit-history-start"});
  /** Accepted submission supplies the response's exact letter-level scoring. */
  const result = await authority.submitRaceGuess({runId: started.run.runId, riddleId: started.run.currentRiddle!.riddleId,
    guess: "wrong", requestId: "reddit-history-guess"});
  /** Negotiated history is optional on the wire while authoritative attempt counters remain mandatory. */
  const run = {...result.run, currentRiddle: {...result.run.currentRiddle!, ...(history ? {confirmedGuesses: [{
    guess: result.feedback.map(entry => entry.letter), feedback: result.feedback.map(entry => entry.status),
  }]} : {})}};
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({ok: true, json: async () => ({ok: true, result: {run}})} as Response);
  /** Actual target adapter owns same-origin transport and strict response parsing. */
  const services = createRedditHostServices();
  await expect(services.resumeRace!(run.runId)).resolves.toEqual({run});
  expect(global.fetch).toHaveBeenCalledWith("/api/game/race.resume", expect.objectContaining({
    body: JSON.stringify({runId: run.runId, includeEvaluation: true, includeGuessHistory: true, contentProtection: 1}),
  }));
});
