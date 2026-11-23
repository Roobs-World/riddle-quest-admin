import {createRedditGuestHostServices} from "../RedditGuestHostServices";
import {computeFeedback} from "../../../../../src/core/game";
import {createSavedGame} from "../../../../../src/hosted/play/GameSessionCheckpoints";
import {createInitialGameSession, gameSessionReducer} from "../../../../../src/hosted/play/gameSession";
import {BridgeRiddleSchema} from "../../../../../src/core/bridge";
import type {HostServices} from "../../../../../src/hosted/hostTypes";

it.each([1, 5])("recovers an accepted win on attempt %s before completion delivery", async count => {
  /** Drives the actual authority, reducer and provider checkpoint before replacing the page. */
  const original = createRedditGuestHostServices();
  /** Ordinary authority-issued first round owns the terminal checkpoint. */
  const issued = await original.loadRiddle({gameMode: "classic", locale: "en"});
  /** Reducer state follows the same submission and acknowledgement sequence as the mounted game. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: issued});
  for(let attempt = 1; attempt <= count; attempt++) {
    /** Final answer wins after the chosen number of accepted attempts. */
    const guess = attempt === count ? "PIANO" : "QQQQQ";
    for(const letter of guess) state = gameSessionReducer(state, {type: "typeLetter", letter});
    state = gameSessionReducer(state, {type: "guessRequested"});
    /** Actual local authority supplies feedback and terminal status. */
    const verdict = await original.submitGuess({riddleId: issued.riddleId, sessionToken: issued.sessionToken,
      gameMode: "classic", guess, requestId: `terminal-${attempt}`});
    if(!verdict) throw new Error("missing-guest-verdict");
    state = gameSessionReducer(state, {type: "guessResolved", ...verdict,
      feedback: {guess: [...guess], feedback: verdict.feedback.map(cell => cell.status)}});
  }
  /** Confirmed terminal state is saved before completion delivery. */
  const checkpoint = createSavedGame(state, 10);
  if(!checkpoint) throw new Error("missing-winning-checkpoint");
  expect(checkpoint.pendingOutcome?.kind).toBe("win");
  /** New page creates a replacement authority from the actual provider checkpoint. */
  const replacement = createRedditGuestHostServices(await original.loadProfile("reddit-guest"), checkpoint);
  /** Replacement projection reaches the same strict bridge contract as the mounted game. */
  const recovered = await replacement.loadRiddle({gameMode: "classic", locale: "en"});
  expect(recovered.attemptsUsed).toBe(count);
  expect(BridgeRiddleSchema.safeParse(recovered).success).toBe(true);
  state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: recovered});
  state = gameSessionReducer(state, {type: "restoreSession", ...checkpoint});
  expect(state.lastOutcome).toEqual(checkpoint.pendingOutcome);
  expect(state.modal).toBe("victory");
  expect(state.engineSnapshot?.gameOver).toBe(true);
  /** Replayed completion retains its issued round identity. */
  const payload = {riddleId: recovered.riddleId, gameMode: "classic" as const, sessionToken: recovered.sessionToken};
  expect(await replacement.completeGame(payload)).toEqual(await replacement.completeGame(payload));
  expect(await replacement.loadProfile("reddit-guest")).toMatchObject({gamesPlayed: 1, wins: 1, classicIndex: 2, coins: 0, xp: 0});
});

it("starts a fresh round when the two-example guest deck cycles", async () => {
  /** One service lifetime drives the same deck cycle as three consecutive UI rounds. */
  const services = createRedditGuestHostServices();
  /** First-round identity must not be reused after advancing through the deck. */
  const first = await services.loadRiddle({gameMode: "classic", locale: "en"});
  for (let index = 1; index <= 2; index++) {
    /** The loaded local evaluation supplies the bundled answer without test-only authority bypasses. */
    const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
    await services.submitGuess({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
      guess: riddle.evaluation!.answer, requestId: `round-${index}`});
    await services.completeGame({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken});
  }
  /** Recycled content begins with an empty grid and a distinct round token. */
  const third = await services.loadRiddle({gameMode: "classic", locale: "en"});
  expect(third.riddleId).toBe(first.riddleId);
  expect(third.attemptsUsed).toBe(0);
  expect(third.acceptedGuesses ?? []).toEqual([]);
  expect(third.sessionToken).not.toBe(first.sessionToken);
});

it("completes a declined five-guess guest round without requiring an unavailable paid attempt", async () => {
  /** Guest play uses the shared five-attempt Continue boundary but has no coin-spend capability. */
  const services = createRedditGuestHostServices();
  /** Current example is issued by the ordinary gameplay seam. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
  for (let index = 0; index < 5; index++) await services.submitGuess({riddleId: riddle.riddleId,
    gameMode: "classic", sessionToken: riddle.sessionToken, guess: "qqqqq", requestId: `wrong-${index}`});
  /** Loading at the boundary must remain compatible with the strict bridge contract. */
  const boundary = await services.loadRiddle({gameMode: "classic", locale: "en"});
  expect(BridgeRiddleSchema.safeParse(boundary).success).toBe(true);
  expect(boundary.awaitingContinue).toBe(true);
  await expect(services.completeGame({riddleId: riddle.riddleId, gameMode: "classic",
    sessionToken: riddle.sessionToken})).resolves.toMatchObject({attempts: 5, isCorrect: false, coinsEarned: 0});
  /** Completion arrives before profile presentation, so the ordinary caller can still send index 1. */
  const next = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1,
    sessionToken: riddle.sessionToken, riddleId: riddle.riddleId});
  expect(next).toMatchObject({index: 2, attemptsUsed: 0, awaitingContinue: false});
  expect(next.sessionToken).not.toBe(riddle.sessionToken);
});

it("counts a guest round once when completion is retried", async () => {
  /** Lost bridge responses can replay a completion against the same local service. */
  const services = createRedditGuestHostServices();
  /** Issued token identifies the completed round. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
  await services.submitGuess({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
    guess: "piano", requestId: "win"});
  /** Completion payload is identical on delivery retry. */
  const payload = {riddleId: riddle.riddleId, gameMode: "classic" as const, sessionToken: riddle.sessionToken};
  expect(await services.completeGame(payload)).toEqual(await services.completeGame(payload));
  await expect(services.loadProfile("reddit-guest")).resolves.toMatchObject({gamesPlayed: 1, wins: 1, classicIndex: 2});
});

it("publishes a completed receipt before synchronous subscribers can replay it", async () => {
  /** The local auth bridge delivers profile changes synchronously. */
  const services = createRedditGuestHostServices();
  /** Issued round supplies the same completion payload to both callers. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
  await services.submitGuess({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
    guess: "piano", requestId: "winning-answer"});
  /** Synchronous profile subscriber represents a receipt replay while the initial call is still publishing. */
  let replay: ReturnType<HostServices["completeGame"]> | undefined;
  /** One subscriber-triggered replay is enough to detect double counting. */
  let replayed = false;
  /** Real completion identity remains independent of notification delivery. */
  const payload = {riddleId: riddle.riddleId, gameMode: "classic" as const, sessionToken: riddle.sessionToken};
  /** Reentry uses the actual publicly subscribed local profile stream. */
  const unsubscribe = services.auth.subscribe(snapshot => {
    if(snapshot.profile?.gamesPlayed === 1 && !replayed){replayed=true;replay=services.completeGame(payload);}
  });
  try{
    /** Both callers receive the same local, non-economic verdict. */
    const result = await services.completeGame(payload);
    expect(await replay).toEqual(result);
    await expect(services.loadProfile("reddit-guest")).resolves.toMatchObject({gamesPlayed: 1, wins: 1, classicIndex: 2});
  }finally{unsubscribe();}
});

it("does not consume another attempt on concurrent guess delivery retries", async () => {
  /** Actual callers can retry before the first transport response arrives. */
  const services = createRedditGuestHostServices();
  /** Issued local identity isolates the receipt. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
  /** Both deliveries represent the same accepted answer. */
  const input = {riddleId: riddle.riddleId, gameMode: "classic" as const, sessionToken: riddle.sessionToken, requestId: "retry", guess: "qqqqq"};
  /** Concurrent receipt results must agree without charging another guess. */
  const results = await Promise.all([services.submitGuess(input), services.submitGuess(input)]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]?.attempts).toBe(1);
  await expect(services.submitGuess({...input, guess: "ppppp"})).rejects.toThrow("reddit-guest-request-conflict");
  /** A different request cannot use an unrelated token or an invalid answer shape. */
  await expect(services.submitGuess({...input, requestId: "stale", sessionToken: "00000000-0000-4000-8000-000000000003"})).rejects.toThrow("reddit-guest-session-not-found");
  await expect(services.submitGuess({...input, requestId: "shape", guess: "q"})).rejects.toThrow("reddit-guest-invalid-guess");
  expect((await services.loadRiddle({gameMode: "classic", locale: "en"})).attemptsUsed).toBe(1);
});

it("restores the fifth-guess decision with all accepted feedback", async () => {
  /** An ordinary checkpoint at the base attempt cap has not purchased any extra attempt. */
  const checkpoint = savedGuestRound();
  for(let index=2;index<5;index++)checkpoint.guesses.push({guess:[..."qqqqq"],feedback:computeFeedback("qqqqq","piano")});
  checkpoint.engineSnapshot.guesses=checkpoint.guesses.map(row=>({guess:[...row.guess],feedback:[...row.feedback]}));
  checkpoint.engineSnapshot.attemptsUsed=5;
  checkpoint.awaitingContinue=true;
  /** Replacement authority must agree with the shared base-limit decision. */
  const services=createRedditGuestHostServices(undefined,checkpoint);
  /** Public projection must pass the same parser as the real local bridge. */
  const riddle=await services.loadRiddle({gameMode:"classic",locale:"en"});
  expect(BridgeRiddleSchema.safeParse(riddle).success).toBe(true);
  expect(riddle).toMatchObject({attemptsUsed:5,awaitingContinue:true,hasUsedContinue:false});
  expect(riddle.acceptedGuesses).toHaveLength(5);
  await expect(services.submitGuess({riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,gameMode:"classic",guess:"piano",requestId:"sixth"})).rejects.toThrow("reddit-guest-session-complete");
});

/** Real checkpoint projection containing two confirmed local wrong answers and a later draft. */
const savedGuestRound = () => {
  /** Feedback is generated by the shared engine, exactly as it was during play. */
  const guesses = ["ppppp", "qqqqq"].map(guess => ({guess: [...guess], feedback: computeFeedback(guess, "piano")}));
  /** The current bundled example has a stable guest-only token. */
  const checkpoint = createSavedGame({...createInitialGameSession(),
    riddle: {riddleId: "reddit-guest-1", text: "What has keys but cannot open doors?", answerLength: 5,
      sessionToken: "00000000-0000-4000-8000-000000000001", gameMode: "classic", attemptsUsed: 2,
      hasUsedContinue: false, awaitingContinue: false},
    engineSnapshot: {guesses, attemptsUsed: 2, hasUsedContinue: false, gameOver: false},
    guesses, currentLetters: ["P", "I", "A", "N", ""], activeSlotIndex: 4,
  }, 10);
  if (!checkpoint) throw new Error("missing-guest-checkpoint");
  return checkpoint;
};

it.each(["colours", "earlier-win", "outcome-count", "outcome-kind", "missing-outcome", "token", "riddle", "mode", "continue", "not-terminal"])(
  "rejects an unproven or inconsistent terminal guest checkpoint: %s", async mismatch => {
    /** Shaped terminal checkpoint still needs evidence from the bundled answer and matching intent. */
    const checkpoint = savedGuestRound();
    checkpoint.guesses[1] = {guess: [..."PIANO"], feedback: Array(5).fill("green")};
    checkpoint.engineSnapshot = {...checkpoint.engineSnapshot, gameOver: true,
      guesses: checkpoint.guesses.map(row => ({guess: [...row.guess], feedback: [...row.feedback]}))};
    checkpoint.pendingOutcome = {id: "terminal-2", kind: "win", isCorrect: true, attempts: 2,
      riddleId: checkpoint.riddleId, sessionToken: checkpoint.sessionToken, gameMode: checkpoint.gameMode};
    if(mismatch === "colours") checkpoint.guesses[1].guess = [..."QQQQQ"];
    if(mismatch === "earlier-win") checkpoint.guesses[0].guess = [..."PIANO"];
    if(mismatch === "outcome-count") checkpoint.pendingOutcome.attempts = 1;
    if(mismatch === "outcome-kind") {checkpoint.pendingOutcome.kind = "loss";checkpoint.pendingOutcome.isCorrect = false;}
    if(mismatch === "missing-outcome") delete checkpoint.pendingOutcome;
    if(mismatch === "token") checkpoint.pendingOutcome.sessionToken = "00000000-0000-4000-8000-000000000002";
    if(mismatch === "riddle") checkpoint.pendingOutcome.riddleId = "reddit-guest-2";
    if(mismatch === "mode") checkpoint.pendingOutcome.gameMode = "challenge";
    if(mismatch === "continue") checkpoint.engineSnapshot.hasUsedContinue = true;
    if(mismatch === "not-terminal") checkpoint.engineSnapshot.gameOver = false;
    /** Local recovery validates the altered checkpoint before accepting completion. */
    const services = createRedditGuestHostServices(undefined, checkpoint);
    /** Public riddle must remain fresh after an ineligible terminal record. */
    const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
    expect(riddle.attemptsUsed).toBe(0);
    await expect(services.completeGame({riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
      gameMode: "classic"})).rejects.toThrow("reddit-guest-game-not-complete");
    expect(await services.loadProfile("reddit-guest")).toMatchObject({gamesPlayed: 0, wins: 0, classicIndex: 1, coins: 0, xp: 0});
});

it("recovers a declined loss without reopening the decision or counting it twice", async () => {
  /** Five wrong guesses and a declined Continue survive before the completion request arrives. */
  const checkpoint = savedGuestRound();
  while(checkpoint.guesses.length < 5) checkpoint.guesses.push({guess: [..."QQQQQ"], feedback: computeFeedback("QQQQQ", "piano")});
  checkpoint.engineSnapshot = {...checkpoint.engineSnapshot, guesses: checkpoint.guesses, attemptsUsed: 5, gameOver: true};
  checkpoint.pendingOutcome = {id: "declined-5", kind: "loss", isCorrect: false, attempts: 5,
    riddleId: checkpoint.riddleId, sessionToken: checkpoint.sessionToken, gameMode: checkpoint.gameMode};
  /** Replacement authority recomputes the five wrong answers from bundled content. */
  const services = createRedditGuestHostServices(undefined, checkpoint);
  /** Recovery projection is validated before the restored declined outcome is delivered. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en"});
  expect(BridgeRiddleSchema.safeParse(riddle).success).toBe(true);
  /** Shared reducer restores the pending loss without another Continue decision. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
  state = gameSessionReducer(state, {type: "restoreSession", ...checkpoint});
  expect(state.lastOutcome).toEqual(checkpoint.pendingOutcome);
  expect(state.modal).toBeNull();
  /** Identical completion requests must update practice statistics once. */
  const payload = {riddleId: riddle.riddleId, sessionToken: riddle.sessionToken, gameMode: "classic" as const};
  expect(await services.completeGame(payload)).toEqual(await services.completeGame(payload));
  expect(await services.loadProfile("reddit-guest")).toMatchObject({gamesPlayed: 1, wins: 0, classicIndex: 2, coins: 0, xp: 0});
});

it("plays classic riddles locally without gateway calls or economic rewards", async () => {
  global.fetch = jest.fn();
  /** Provides services behavior. */
  const services = createRedditGuestHostServices();
  /** Provides snapshots behavior. */
  const snapshots: unknown[] = [];
  services.auth.subscribe((snapshot) => snapshots.push(snapshot));
  /** Provides riddle behavior. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
  await expect(
    services.submitGuess({
      riddleId: riddle.riddleId,
      gameMode: "classic",
      sessionToken: riddle.sessionToken,
      guess: "piano",
      requestId: "guest-guess",
    }),
  ).resolves.toMatchObject({isCorrect: true, gameOver: true});
  await expect(
    services.completeGame({
      riddleId: riddle.riddleId,
      gameMode: "classic",
      sessionToken: riddle.sessionToken,
    }),
  ).resolves.toMatchObject({coinsEarned: 0, newXp: 0, rewardBreakdown: {newBalance: 0, totalAwarded: 0}});
  expect(snapshots.at(-1)).toMatchObject({profile: {coins: 0, xp: 0, wins: 1, classicIndex: 2}});
  expect(global.fetch).not.toHaveBeenCalled();
});

it("fails closed for economic, daily, identity, and social capabilities", async () => {
  /** Provides services behavior. */
  const services = createRedditGuestHostServices();
  expect(services.products).toEqual([]);
  await expect(services.loadRiddle({gameMode: "challenge", locale: "en"})).rejects.toThrow("reddit-login-required");
  await expect(services.requestPurchase("coins")).rejects.toThrow("reddit-login-required");
  await expect(services.requestHint({} as never)).rejects.toThrow("reddit-login-required");
  await expect(services.startRace({} as never)).rejects.toThrow("reddit-login-required");
  await expect(services.updateUsername("forged")).rejects.toThrow("reddit-login-required");
});

it("restores only bounded non-economic guest progression", async () => {
  /** Provides services behavior. */
  const services = createRedditGuestHostServices({
    username: "Forged",
    coins: 99_999,
    level: 99,
    xp: 99_999,
    winStreak: 99,
    gamesPlayed: 4,
    wins: 3,
    achievements: ["forged"],
    classicIndex: 2,
  });
  await expect(services.loadProfile("reddit-guest")).resolves.toMatchObject({
    username: "Guest Solver",
    coins: 0,
    level: 1,
    xp: 0,
    winStreak: 0,
    gamesPlayed: 4,
    wins: 3,
    achievements: [],
    classicIndex: 2,
  });
});

it("resumes the actual guest attempt count and feedback before accepting another answer", async () => {
  /** Replacement local authority must agree with its acknowledged round checkpoint. */
  const services = createRedditGuestHostServices(undefined, savedGuestRound());
  /** Riddle recovery uses the ordinary provider seam consumed by the shared game. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
  expect(BridgeRiddleSchema.safeParse(riddle).success).toBe(true);
  expect(riddle.attemptsUsed).toBe(2);
  expect(riddle.acceptedGuesses?.map(row => row.feedback.map(cell => cell.status))).toEqual([
    ["green", "red", "red", "red", "red"], ["red", "red", "red", "red", "red"],
  ]);
  await expect(services.submitGuess({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
    guess: "piano", requestId: "resumed-answer"})).resolves.toMatchObject({attempts: 3, isCorrect: true});
});

it("recomputes stored guest feedback from bundled content", async () => {
  /** Validly shaped but incorrect client colours must not become local verdicts. */
  const checkpoint = savedGuestRound();
  checkpoint.guesses.forEach(row => row.feedback.fill("green"));
  checkpoint.engineSnapshot.guesses.forEach(row => row.feedback.fill("green"));
  /** The guest deck remains the local source for the answer and its feedback. */
  const services = createRedditGuestHostServices(undefined, checkpoint);
  /** Public load returns recomputed evidence. */
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
  expect(riddle.acceptedGuesses?.[1]?.feedback.map(cell => cell.status)).toEqual(["red", "red", "red", "red", "red"]);
});

it.each(["riddle", "token", "mode", "continue", "terminal", "shape"])("ignores unrelated or ineligible saved guest rounds: %s", async mismatch => {
  /** Each altered record must be independently rejected before local attempt recovery. */
  const checkpoint = savedGuestRound();
  if (mismatch === "riddle") checkpoint.riddleId = "reddit-guest-2";
  if (mismatch === "token") checkpoint.sessionToken = "00000000-0000-4000-8000-000000000002";
  if (mismatch === "mode") checkpoint.gameMode = "challenge";
  if (mismatch === "continue") checkpoint.engineSnapshot.hasUsedContinue = true;
  if (mismatch === "terminal") checkpoint.engineSnapshot.gameOver = true;
  if (mismatch === "shape") checkpoint.guesses[0]!.guess.pop();
  /** Public guest load must retain a fresh valid local example. */
  const riddle = await createRedditGuestHostServices(undefined, checkpoint).loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
  expect(riddle.attemptsUsed).toBe(0);
  expect(riddle.acceptedGuesses).toBeUndefined();
});

it("scores the bundled English deck consistently when the browser defaults to Turkish casing", async () => {
  /** Browser locale must not change the guest deck's answer normalization. */
  const lowerCase = String.prototype.toLocaleLowerCase;
  /** Reproduces the browser's locale-sensitive default while preserving explicitly chosen locales. */
  const browserDefault = jest.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(function(locales) {
    return lowerCase.call(this, locales ?? "tr");
  });
  try {
    /** Guest authority uses the same English evaluation contract as its shared game. */
    const services = createRedditGuestHostServices();
    /** Issued local example identifies the evaluation locale. */
    const riddle = await services.loadRiddle({gameMode: "classic", locale: "tr", classicIndex: 1});
    await expect(services.submitGuess({riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
      guess: "PIANO", requestId: "locale-answer"})).resolves.toMatchObject({isCorrect: true});
  } finally {browserDefault.mockRestore();}
});
