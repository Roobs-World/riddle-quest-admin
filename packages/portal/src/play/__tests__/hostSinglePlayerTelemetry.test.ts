import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import {configurePlatformAnalytics, resetAnalyticsForTests} from "../../analytics/events";
import {createHostCompletionEffects, createHostGuessEffects, type HostCompletionInput} from "../hostCompletionEffects";
import type {CompletionResult, SinglePlayerGuessResult} from "@qwordly/hosted/hostTypes";

/** Stable issuing identity remains private to the effect consumer. */
const input: HostCompletionInput = {riddleId: "classic-1", gameMode: "classic", sessionToken: "private-issued-session"};
/** Server-confirmed accepted answer, independent of transport request identity. */
const guess: SinglePlayerGuessResult = {feedback: [{letter: "p", status: "green"}], attempts: 1, isCorrect: true, gameOver: true};
/** Canonical reward metadata exercises all three completion event types. */
const completion: CompletionResult = {attempts: 1, isCorrect: true, coinsEarned: 50,
  newlyUnlockedAchievementIds: ["first_win"], newLevel: 2, leveledUp: true};
/** Observes only sanitized provider events without connecting a real provider SDK. */
const events = jest.fn();
beforeEach(() => {resetAnalyticsForTests(); events.mockClear(); configurePlatformAnalytics(events);});
afterEach(resetAnalyticsForTests);

it("records one accepted guess and one target win across transport and semantic retries", async () => {
  /** Replays share one immutable game identity and authoritative attempt counter. */
  const deliver = createHostGuessEffects(() => true), record = jest.fn();
  await Promise.all([deliver(input, guess, record), deliver({...input}, {...guess}, record), deliver(input, guess, record)]);
  expect(record).toHaveBeenCalledTimes(1);
  expect(events).toHaveBeenCalledTimes(1);
  expect(events).toHaveBeenCalledWith("guess_submitted", {game_mode: "classic", success: true, attempts: 1});
});
it("records distinct accepted attempts and only the winning attempt prompts the target", async () => {
  /** Failed accepted guesses remain distinct gameplay facts. */
  const deliver = createHostGuessEffects(() => true), record = jest.fn();
  await deliver(input, {...guess, isCorrect: false, gameOver: false}, record);
  await deliver(input, {...guess, attempts: 2, isCorrect: false, gameOver: false}, record);
  await deliver(input, {...guess, attempts: 3}, record);
  expect(events).toHaveBeenCalledTimes(3); expect(record).toHaveBeenCalledTimes(1);
});
it("preserves independent issued sessions, riddles, and modes", async () => {
  /** Accepted attempt counters alone cannot identify a game. */
  const deliver = createHostGuessEffects(() => true), record = jest.fn();
  /** Different issuing contexts remain eligible within one account visit. */
  const inputs: HostCompletionInput[] = [input, {...input, sessionToken: "other-private-session"},
    {...input, riddleId: "classic-2"}, {...input, gameMode: "challenge"}];
  for (const issued of inputs) await deliver(issued, guess, record);
  expect(record).toHaveBeenCalledTimes(4); expect(events).toHaveBeenCalledTimes(4);
});
it("suppresses guess prompting and telemetry after account visit retirement", async () => {
  /** No retired receipt can be attributed to the replacement analytics session. */
  const record = jest.fn();
  await createHostGuessEffects(() => false)(input, guess, record);
  expect(record).not.toHaveBeenCalled(); expect(events).not.toHaveBeenCalled();
});
it("rechecks target ownership if synchronous analytics retires the account", async () => {
  /** Provider event hooks may synchronously replace the current account. */
  let owned = true;
  configurePlatformAnalytics(() => {owned = false;});
  /** Target callbacks require ownership independently of the preceding analytics call. */
  const record = jest.fn();
  await createHostGuessEffects(() => owned)(input, guess, record);
  expect(record).not.toHaveBeenCalled();
});
it("does not replay partially executed win callbacks after optional failure", async () => {
  /** Registration UI or engagement may have changed before an optional callback rejects. */
  const deliver = createHostGuessEffects(() => true), record = jest.fn(async () => {throw new Error("optional outage");});
  await expect(deliver(input, guess, record)).rejects.toThrow("optional outage");
  await deliver(input, guess, record);
  expect(record).toHaveBeenCalledTimes(1); expect(events).toHaveBeenCalledTimes(1);
});
it("consumes guess effects before awaiting asynchronous target work", async () => {
  /** Provider work can stay pending while accepted receipts are independently acknowledged. */
  let finish!: () => void;
  /** Held callback acknowledgment exercises overlapping optional deliveries. */
  const pending = new Promise<void>(resolve => {finish = resolve;}), deliver = createHostGuessEffects(() => true), record = jest.fn(() => pending);
  /** First optional delivery retains the provider wait without admitting repeat work. */
  const first = deliver(input, guess, record);
  await deliver(input, guess, record);
  expect(record).toHaveBeenCalledTimes(1); expect(events).toHaveBeenCalledTimes(1);
  finish(); await first;
});
it("gives later account visits independent accepted-guess consumers", async () => {
  /** Same UID re-entry cannot reuse the retired consumer or suppress current progress. */
  const record = jest.fn();
  await createHostGuessEffects(() => true)(input, guess, record);
  await createHostGuessEffects(() => true)(input, guess, record);
  expect(record).toHaveBeenCalledTimes(2); expect(events).toHaveBeenCalledTimes(2);
});
it("does not expose riddle IDs, tokens, answers, or client retry identities in gameplay events", async () => {
  await createHostGuessEffects(() => true)(input, guess);
  expect(events).toHaveBeenCalledWith("guess_submitted", {game_mode: "classic", success: true, attempts: 1});
  expect(JSON.stringify(events.mock.calls)).not.toContain(input.sessionToken);
  expect(JSON.stringify(events.mock.calls)).not.toContain(input.riddleId);
});
it("consumes level-end, level-up, and achievement events with the owned completion", async () => {
  /** Completion effects and analytics share one stable consumption boundary. */
  const deliver = createHostCompletionEffects(() => true);
  await Promise.all([deliver(input, completion), deliver({...input}, {...completion}), deliver(input, completion)]);
  expect(events.mock.calls.map(call => call[0])).toEqual(["level_end", "level_up", "unlock_achievement"]);
});
it("does not emit completion events after the originating visit retires", async () => {
  await createHostCompletionEffects(() => false)(input, completion);
  expect(events).not.toHaveBeenCalled();
});
it("does not repeat completion telemetry after partial provider recording rejects", async () => {
  /** Optional recording failure does not redefine the already accepted completion fact. */
  const deliver = createHostCompletionEffects(() => true), record = jest.fn(async () => {throw new Error("optional outage");});
  await expect(deliver(input, completion, record)).rejects.toThrow("optional outage");
  await deliver(input, completion, record);
  expect(events.mock.calls.map(call => call[0])).toEqual(["level_end", "level_up", "unlock_achievement"]);
  expect(record).toHaveBeenCalledTimes(1);
});
