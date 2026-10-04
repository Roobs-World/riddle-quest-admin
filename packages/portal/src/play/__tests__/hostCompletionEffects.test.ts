import {expect, it, jest} from "@jest/globals";
import {createHostCompletionEffects, type HostCompletionInput} from "../hostCompletionEffects";
import type {CompletionResult} from "../types";

/** One accepted, server-owned Classic completion. */
const input: HostCompletionInput = {riddleId: "classic-1", gameMode: "classic", sessionToken: "issued-session-one"};
/** Receipt correctness and rewards are never manufactured by optional target effects. */
const result: CompletionResult = {attempts: 1, isCorrect: true, coinsEarned: 50, newlyUnlockedAchievementIds: []};
/** Held provider callback makes retirement during optional work reproducible. */
const deferred = () => {
  /** Resolves provider acknowledgment independently of reward delivery. */
  let resolve!: () => void;
  /** Provider work remains pending until the test explicitly releases it. */
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
};

it("consumes overlapping completion callbacks before the first provider acknowledgment", async () => {
  /** Shared consumer owns one authentication visit. */
  const deliver = createHostCompletionEffects(() => true), held = deferred();
  /** Optional provider side effects run once while reward handlers remain independent. */
  const record = jest.fn(() => held.promise), show = jest.fn(async () => undefined);
  /** All attempts describe the same issued puzzle, regardless of transport retry ID. */
  const first = deliver(input, result, record, show);
  await Promise.all([deliver({...input}, {...result}, record, show), deliver(input, result, record, show)]);
  expect(record).toHaveBeenCalledTimes(1); expect(show).not.toHaveBeenCalled();
  held.resolve(); await first; expect(show).toHaveBeenCalledTimes(1);
});
it("retains consumption when target callbacks are replaced after a profile update", async () => {
  /** Callback replacement cannot create a new issued outcome. */
  const deliver = createHostCompletionEffects(() => true), record = jest.fn(), show = jest.fn();
  await deliver(input, result, record, show);
  /** Newly rendered callbacks must not replay already-consumed effects. */
  const replacementRecord = jest.fn(), replacementShow = jest.fn();
  await deliver(input, result, replacementRecord, replacementShow);
  expect(replacementRecord).not.toHaveBeenCalled(); expect(replacementShow).not.toHaveBeenCalled();
});
it("allows distinct issued sessions, riddles, and game modes", async () => {
  /** Identity includes all issuing context, rather than the currently visible question. */
  const deliver = createHostCompletionEffects(() => true), record = jest.fn(), show = jest.fn();
  for (const outcome of [input, {...input, sessionToken: "issued-session-two"}, {...input, riddleId: "classic-2"},
    {...input, gameMode: "challenge" as const}]) await deliver(outcome, result, record, show);
  expect(record).toHaveBeenCalledTimes(4); expect(show).toHaveBeenCalledTimes(4);
});
it("ignores receipts delivered after the admitting account visit retires", async () => {
  /** Even reused UIDs have a fresh visit owner. */
  const record = jest.fn(), show = jest.fn();
  await createHostCompletionEffects(() => false)(input, result, record, show);
  expect(record).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled();
});
it("checks ownership again after the provider acknowledgment", async () => {
  /** The original visit retires while notification work remains pending. */
  let owned = true;
  /** Held acknowledgment controls the second optional callback boundary. */
  const deliver = createHostCompletionEffects(() => owned), held = deferred(), record = jest.fn(() => held.promise), show = jest.fn();
  /** Recording begins while the original owner remains selected. */
  const delivery = deliver(input, result, record, show);
  owned = false; held.resolve(); await delivery;
  expect(record).toHaveBeenCalledTimes(1); expect(show).not.toHaveBeenCalled();
});
it("does not replay partial provider work after its callback rejects", async () => {
  /** A rejected optional callback may already have recorded engagement or sent provider work. */
  const deliver = createHostCompletionEffects(() => true), record = jest.fn(async () => {throw new Error("provider outage");}), show = jest.fn();
  await expect(deliver(input, result, record, show)).rejects.toThrow("provider outage");
  await deliver(input, result, record, show);
  expect(record).toHaveBeenCalledTimes(1); expect(show).not.toHaveBeenCalled();
});
it("gives a fresh account visit independent completion consumption", async () => {
  /** New visits do not inherit the old consumer's receipt set. */
  const record = jest.fn(), show = jest.fn();
  await createHostCompletionEffects(() => true)(input, result, record, show);
  await createHostCompletionEffects(() => true)(input, result, record, show);
  expect(record).toHaveBeenCalledTimes(2); expect(show).toHaveBeenCalledTimes(2);
});
it("still delivers result presentation when the target has no recording callback", async () => {
  /** Targets without notifications retain their normal result action. */
  const show = jest.fn();
  await createHostCompletionEffects(() => true)(input, result, undefined, show);
  expect(show).toHaveBeenCalledTimes(1);
});
