import {RACE_RULES, RaceGhostEventSchema, RaceOpponentSchema, RaceRunViewSchema, type RaceRunView} from "../raceSchemas";

/** Sparse valid history proves aggregate bounds without requiring reconstructed legacy events. */
const fixture = (): RaceRunView => ({runId: "event-aggregate", role: "creator", status: "active", categoryId: "history", locale: "en", rules: RACE_RULES,
  correctCount: 1, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000,
  currentRiddle: {riddleId: "current", text: "A clue", answerLength: 5, position: 1, guessesUsed: 0, guessesRemaining: 5, hintAvailable: true, revealedLetters: []},
  events: [{sequence: 0, type: "correct", riddlePosition: 0, wallElapsedMs: 1000, penaltyAddedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 1000, correctCount: 1}]});

it.each(["score", "wall", "penalty"])("rejects known event %s beyond its containing run", kind => {
  /** The event and containing run are each individually shaped but contradict their shared aggregate. */
  const run = fixture();
  if (kind === "score") run.events[0].correctCount = 2;
  if (kind === "wall") {run.events[0].wallElapsedMs = 1001;run.events[0].adjustedElapsedMs = 1001;}
  if (kind === "penalty") Object.assign(run.events[0], {type: "hint", riddlePosition: 1, penaltyAddedMs: 15000, totalPenaltyMs: 15000, adjustedElapsedMs: 16000});
  expect(RaceGhostEventSchema.safeParse(run.events[0]).success).toBe(true);
  expect(RaceRunViewSchema.safeParse(run).success).toBe(false);
});
it.each(["hint", "skip"] as const)("rejects an event that omits its own %s charge", type => {
  /** Cumulative charges cannot be smaller than this event's new accepted penalty. */
  const event = {...fixture().events[0], type, penaltyAddedMs: type === "hint" ? 15000 : 45000, totalPenaltyMs: 0};
  expect(RaceGhostEventSchema.safeParse(event).success).toBe(false);
});
it("rejects opponent playback beyond its fixed adjusted finish", () => {
  /** A shape-valid event cannot take place after the recording is complete. */
  const opponent = {displayName: "Nova", adjustedFinishMs: 999, events: fixture().events};
  expect(RaceOpponentSchema.safeParse(opponent).success).toBe(false);
});
it.each(["current", "sparse-legacy", "paid", "terminal", "empty", "opponent-boundary"])("accepts retained aggregate-compatible history: %s", kind => {
  /** Known history is bounded without demanding omitted older scoring events. */
  const run = fixture();
  if (kind === "sparse-legacy") {run.currentRiddle!.position = 5;run.events[0].riddlePosition = 3;}
  if (kind === "paid") {run.totalPenaltyMs = 15000;run.adjustedElapsedMs = 16000;
    Object.assign(run.events[0], {type: "hint", riddlePosition: 1, penaltyAddedMs: 15000, totalPenaltyMs: 15000, adjustedElapsedMs: 16000});}
  if (kind === "terminal") {run.status = "completed";run.correctCount = 10;run.currentRiddle = null;}
  if (kind === "empty") run.events = [];
  if (kind === "opponent-boundary") run.opponent = {displayName: "Nova", adjustedFinishMs: 1000, events: run.events.map(event => ({...event}))};
  expect(RaceRunViewSchema.safeParse(run).success).toBe(true);
});
it.each(["hint", "skip"] as const)("accepts a %s event that crosses a terminal penalty deadline", type => {
  /** A charged action may overshoot the competitive finish, whose normalized wall clock is capped. */
  const run = fixture();run.status = "completed";run.currentRiddle = null;
  run.totalPenaltyMs = type === "hint" ? 15000 : 45000;run.wallElapsedMs = 0;run.adjustedElapsedMs = run.totalPenaltyMs;
  Object.assign(run.events[0], {type, penaltyAddedMs: run.totalPenaltyMs, totalPenaltyMs: run.totalPenaltyMs,
    wallElapsedMs: 1000, adjustedElapsedMs: 1000 + run.totalPenaltyMs});
  expect(RaceRunViewSchema.safeParse(run).success).toBe(true);
});
