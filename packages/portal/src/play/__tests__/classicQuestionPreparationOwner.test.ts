import {beforeEach, expect, it, jest} from "@jest/globals";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import {createInitialGameSession, gameSessionReducer} from "@riddle-quest/hosted/play/gameSession";
import type {GameSessionState} from "@riddle-quest/hosted/play/gameSessionTypes";
/** Retained passive callbacks are delivered explicitly across committed ownership changes. */
const effects: Array<() => void> = [];
/** Hook cells survive parent renders and layout retirement. */
const refs: Array<{
  /** Mutable hook value. */
  current: unknown}> = [];
/** Memoized account visit tokens are stable across ordinary state edits. */
const memos: Array<{
  /** Dependencies compared by identity. */
  deps: unknown[];
  /** Current memo. */
  value: unknown}> = [];
/** Layout scopes retire before retained passive effects can be delivered. */
const layouts: Array<{
  /** Committed dependencies. */
  deps: unknown[];
  /** Layout cleanup. */
  cleanup?: () => void}> = [];
/** Ordered hook positions are reset for each simulated render. */
let ri = 0, mi = 0, li = 0;
jest.mock("react", () => ({useEffect: (effect: () => void) => effects.push(effect),
  useRef: (current: unknown) => {
  /** Every render visits initialized cells too. */
    const i = ri++; return refs[i] ?? (refs[i] = {current});},
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    /** Stable account dependencies preserve issued preparation ownership. */
    const i = mi++, old = memos[i]; if (!old || deps.some((x, j) => !Object.is(x, old.deps[j]))) memos[i] = {deps, value: factory()};
    return memos[i]!.value;
  }, useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    /** Commit replaces the preceding layout lifetime synchronously. */
    const i = li++, old = layouts[i]; if (!old || deps.some((x, j) => !Object.is(x, old.deps[j]))) {old?.cleanup?.(); layouts[i] = {deps, cleanup: effect() ?? undefined};}
  }}));
import {useClassicQuestionPreparation} from "../game/hooks/useClassicQuestionPreparation";
beforeEach(() => {effects.length = refs.length = memos.length = layouts.length = 0; ri = mi = li = 0;});
/** A legitimate Classic win supplies exact account, outcome and predecessor identities. */
const winning = (): GameSessionState => {
  /** Issued question shared by the reducer and bridge preparation. */
  const riddle = {riddleId: "q1", text: "Clue", answerLength: 5, sessionToken: "00000000-0000-4000-8000-000000000001", gameMode: "classic" as const, index: 1};
  /** The reducer supplies the same terminal identity used by the actual victory UI. */
  const state = gameSessionReducer(gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle}),
    {type: "guessResolved", feedback: {guess: [..."piano"], feedback: Array(5).fill("green")}, attempts: 1, isCorrect: true, gameOver: true, canContinue: false});
  return {...state, locale: "en", user: {uid: "player", accountGeneration: 1, displayName: "Player", isAnonymous: true}};
};
/** Deliberately separates committed layouts from retained passive deliveries. */
const render = (state: GameSessionState, postToHost: (message: GameToHostMessage) => void, enabled = true) => {
  ri = mi = li = 0; useClassicQuestionPreparation({enabled, state, postToHost});
};
it("prepares once across StrictMode passive replay and repeated victory renders", () => {
  /** Stable sender and account keep the optional read idempotent in this presentation lifetime. */
  const post = jest.fn(), state = winning(); render(state, post); effects[0]!(); effects[0]!();
  for (let i = 0; i < 32; i++) {render({...state}, post); effects.at(-1)!();}
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "game:loadRiddle", payload: {gameMode: "classic", locale: "en",
    classicIndex: 2, sessionToken: state.riddle!.sessionToken, riddleId: "q1", prepareNext: true}}));
});
it.each(["uid", "generation", "locale", "sender", "disabled", "question", "outcome", "unmount"])("retires old passive preparation after %s changes", kind => {
  /** An old victory callback may be delivered after its owning account or sender has committed replacement. */
  const old = jest.fn(), replacement = jest.fn(), state = winning(); render(state, old);
  /** Original passive delivery is retained until after synchronous layout retirement. */
  const delayed = effects[0]!;
  if (kind === "unmount") layouts.forEach(x => x.cleanup?.());
  else render({...state,
    user: {...state.user!, ...(kind === "uid" ? {uid: "other"} : {}), ...(kind === "generation" ? {accountGeneration: 2} : {})},
    locale: kind === "locale" ? "fr" : "en",
    riddle: kind === "question" ? {...state.riddle!, sessionToken: "00000000-0000-4000-8000-000000000002"} : state.riddle,
    lastOutcome: kind === "outcome" ? null : state.lastOutcome}, kind === "sender" ? replacement : old, kind !== "disabled");
  delayed(); expect(old).not.toHaveBeenCalled(); expect(replacement).not.toHaveBeenCalled();
});
it.each(["daily", "loss", "no-user", "no-index", "unsafe-index", "mismatched-outcome"])("avoids optional preparation for %s", kind => {
  /** Preparation is limited to an indexed Classic win belonging to the current player question. */
  const state = winning(), post = jest.fn();
  if (kind === "daily") state.riddle = {...state.riddle!, gameMode: "challenge"};
  if (kind === "loss") state.lastOutcome = {...state.lastOutcome!, kind: "loss"};
  if (kind === "no-user") state.user = null;
  if (kind === "no-index") state.riddle = {...state.riddle!, index: undefined};
  if (kind === "unsafe-index") state.riddle = {...state.riddle!, index: Number.MAX_SAFE_INTEGER};
  if (kind === "mismatched-outcome") state.lastOutcome = {...state.lastOutcome!, sessionToken: "foreign"};
  render(state, post); effects[0]!(); expect(post).not.toHaveBeenCalled();
});
it("does not interrupt victory when the optional sender fails", () => {
  /** A transport failure leaves ordinary Next to perform its normal correlated read. */
  const post = jest.fn(() => {throw new Error("retired sender");}); render(winning(), post);
  expect(() => effects[0]!()).not.toThrow(); expect(post).toHaveBeenCalledTimes(1);
});
