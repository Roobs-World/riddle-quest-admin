import {beforeEach, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {GameSessionAction, GameSessionState, PendingGuessState} from "../gameSessionTypes";

/** Run the real recovery owner's mount effects against the real reducer. */
const mockEffects: Array<() => unknown> = [];
/** Commit ownership before exercising mount recovery effects. */
const mockLayoutEffects: Array<() => unknown> = [];
jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useLayoutEffect: (effect: () => unknown) => {mockLayoutEffects.push(effect);},
  useEffect: (effect: () => unknown) => {mockEffects.push(effect);},
  useRef: <T>(current: T) => ({current}),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === "function" ? (initial as () => T)() : initial, jest.fn(),
  ],
}));
import {createInitialGameSession, gameSessionReducer} from "../gameSession";
import {createPendingPlayJournalStorage, pendingPlayScope, type PendingGuessJournal} from "../pendingGuessJournal";
import {useProvisionalPlayRecovery, type PendingPlayRecoveryAdapters} from "../game/hooks/useProvisionalPlayRecovery";

beforeEach(() => {mockEffects.length = 0; mockLayoutEffects.length = 0;});

/** Immutable issued questions representing the hosted locale-return sequence. */
const predecessor: BridgeRiddle = {
  riddleId: "classic_11", sessionToken: "test-issued-session-hamster-11", text: "A small pet rodent",
  answerLength: 7, gameMode: "classic", index: 11, evaluation: {answer: "hamster", locale: "en"},
};
/** Issued next prompt that remains active across journal reconciliation. */
const successor: BridgeRiddle = {...predecessor, riddleId: "classic_12",
  sessionToken: "test-issued-session-coconut-12", text: "A hairy fruit", index: 12,
  evaluation: {answer: "coconut", locale: "en"}};

/** Persist only the gameplay fields captured by the production journal. */
function capture(state: GameSessionState): PendingGuessState {
  /** Gameplay-only fields captured by the pending guess journal. */
  const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds} = state;
  return {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds};
}

it.each([false, true])("keeps Settings open on locale return with journal recovery=%s", (recover) => {
  /** Fresh mount occurs after returning to the original content locale. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: successor});
  state = {...state, user: {uid: "recovery-player", isAnonymous: true}};
  state = gameSessionReducer(state, {type: "openModal", modal: "settings"});
  /** Latest reducer state observed by asynchronous recovery operations. */
  const stateRef = {current: state};
  /** Journal identity tied to this account and original content locale. */
  const scope = pendingPlayScope(state.user!.uid, undefined, "en");
  /** Confirmed predecessor state captured before the queued win. */
  const before = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: predecessor});
  /** Successor draft retained before locale return. */
  const next = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: successor});
  /** Idempotency key for the predecessor winning guess. */
  const requestId = "guess-retained-hamster";
  /** Pending predecessor receipt and its already projected successor draft. */
  const journal: PendingGuessJournal = {version: 1, scope, confirmedClassicIndex: 11,
    riddle: predecessor, base: capture(before), draft: [],
    successors: [{riddle: successor, base: capture(next), draft: [...next.currentLetters], draftActiveSlotIndex: 0}],
    queue: [{message: {type: "game:submitGuess", requestId,
      payload: {riddleId: predecessor.riddleId, sessionToken: predecessor.sessionToken,
        gameMode: "classic", guess: "HAMSTER", requestId}},
      attempts: 1, isCorrect: true, gameOver: true, canContinue: false,
      feedback: Array.from({length: 7}, () => "green")}],
  };
  /** Isolated durable journal records for the mount recovery fixture. */
  const values = new Map<string, string>();
  /** Production journal adapter backed by the isolated test records. */
  const storage = createPendingPlayJournalStorage({getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {values.set(key, value);}, removeItem: key => {values.delete(key);}});
  if (recover) expect(storage.write(journal)).toBe(true);
  /** Controlled persistence and timers supplied to the real recovery hook. */
  const adapters: PendingPlayRecoveryAdapters = {journal: storage, clock: {
    now: () => 1_000, setTimeout: () => 1, clearTimeout: () => undefined,
    setInterval: () => 2, clearInterval: () => undefined,
  }};
  /** Reducer actions emitted during the recovery mount. */
  const actions: GameSessionAction[] = [];
  /** Host bridge spy recording retained operation replay. */
  const post = jest.fn();
  /** Original window descriptor restored after the native lifecycle fixture. */
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {configurable: true,
    value: {addEventListener: () => undefined, removeEventListener: () => undefined}});
  try {
    useProvisionalPlayRecovery({state, stateRef, adapters, postToHost: post, playFeedback: jest.fn(),
      dispatch: action => {
        actions.push(action);
        stateRef.current = gameSessionReducer(stateRef.current, action);
      }});
    for (const effect of mockLayoutEffects) effect();
    for (const effect of mockEffects) effect();
    if (recover) {
      expect(actions.map(action => action.type)).toContain("restoreQueuedGuesses");
      expect(post).toHaveBeenCalledWith(journal.queue[0]!.message);
    } else {
      expect(actions).toEqual([]);
      expect(post).not.toHaveBeenCalled();
    }
    expect(stateRef.current.riddle?.sessionToken).toBe(successor.sessionToken);
    expect(stateRef.current.currentLetters).toEqual(next.currentLetters);
    expect(stateRef.current.modal).toBe("settings");
  } finally {
    if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
