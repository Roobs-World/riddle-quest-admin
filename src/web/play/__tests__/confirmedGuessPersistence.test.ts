import {expect, it, jest} from "@jest/globals";
import type {GameSessionState} from "../../../hosted/play/gameSession";
import type {SavedGame} from "../../platform/types";

/** Hook slots retain React's dependency identity across controlled renders. */
const mockSlots: {
  /** Controlled effects isolate persistence and startup sequencing. */
  dependencies?: readonly unknown[];
  /** Observed value supplies the recovery assertion baseline. */
  value?: unknown}[] = [];
/** Current hook position in one render. */
let mockSlotIndex = 0;
/** Effects scheduled by changed dependencies. */
let mockEffects: (() => unknown)[] = [];
/** Layout work commits snapshots before this legacy harness runs passive persistence. */
let mockLayoutEffects: (() => unknown)[] = [];
jest.mock("react", () => ({
  useRef: <T>(current: T) => {
    /** Zero-based answer slot must stay within the issued grapheme shape. */
    const index = mockSlotIndex++;
    return (mockSlots[index] ??= {value: {current}}).value;
  },
  useCallback: <T>(callback: T, dependencies: readonly unknown[]) => {
    /** Zero-based answer slot must stay within the issued grapheme shape. */
    const index = mockSlotIndex++;
    /** Earlier state supplies the baseline for recovery and ownership assertions. */
    const previous = mockSlots[index];
    if (!previous || dependencies.some((value, slot) => !Object.is(value, previous.dependencies?.[slot])))
      mockSlots[index] = {dependencies, value: callback};
    return mockSlots[index].value;
  },
  useEffect: (effect: () => unknown, dependencies: readonly unknown[]) => {
    /** Zero-based answer slot must stay within the issued grapheme shape. */
    const index = mockSlotIndex++;
    /** Earlier state supplies the baseline for recovery and ownership assertions. */
    const previous = mockSlots[index];
    if (!previous || dependencies.some((value, slot) => !Object.is(value, previous.dependencies?.[slot])))
      mockEffects.push(effect);
    mockSlots[index] = {dependencies};
  },
  useLayoutEffect: (effect: () => unknown, dependencies: readonly unknown[]) => {
    /** Current committed-effect slot retains dependency identity across renders. */
    const index = mockSlotIndex++;
    /** Earlier layout dependencies determine whether the commit needs a new snapshot. */
    const previous = mockSlots[index];
    if (!previous || dependencies.some((value, slot) => !Object.is(value, previous.dependencies?.[slot])))
      mockLayoutEffects.push(effect);
    mockSlots[index] = {dependencies};
  },
}));
import {createInitialGameSession, gameSessionReducer} from "../../../hosted/play/gameSession";
import {useGameSessionPersistence} from "../game/hooks/useGameSessionPersistence";

it("checkpoints the fifth confirmed row before reload when confirmation changes only pending state", () => {
  mockSlots.length = 0;
  Object.defineProperty(globalThis, "document", {configurable: true, value: {
    addEventListener: jest.fn(), removeEventListener: jest.fn(), visibilityState: "visible",
  }});
  Object.defineProperty(globalThis, "window", {configurable: true, value: {
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }});
  /** Authoritative or observed state used to verify the current transition. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    riddleId: "daily-2026-10-02", sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "challenge", text: "Wire loops for beating eggs?", answerLength: 5,
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
    evaluation: {answer: "whisk", locale: "en"},
  }});
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const letter of "AAAAA") state = gameSessionReducer(state, {type: "typeLetter", letter});
    state = gameSessionReducer(state, {type: "guessRequested"});
    state = gameSessionReducer(state, {type: "guessPreviewConfirmed"});
  }
  for (const letter of "CCCCC") state = gameSessionReducer(state, {type: "typeLetter", letter});
  /** Mutable render state tracks persistence callback updates. */
  const stateRef = {current: state};
  /** Observed persistence writes retain authoritative accepted guess state. */
  const save = jest.fn<(game: SavedGame | null) => void>();
  /** Captured actions expose reducer transitions without changing authority. */
  const dispatch = jest.fn();
  /** Fixture rendering installs the current persistence callback. */
  const render = (next: GameSessionState) => {
    stateRef.current = next;
    mockSlotIndex = 0;
    mockEffects = [];
    mockLayoutEffects = [];
    useGameSessionPersistence({state: next, stateRef, dispatch, onSaveGame: save});
    for (const effect of mockLayoutEffects) effect();
    for (const effect of mockEffects) effect();
  };
  render(state);
  state = gameSessionReducer(state, {type: "guessRequested"});
  render(state);
  expect(save).not.toHaveBeenCalled();
  state = gameSessionReducer(state, {type: "guessCheckpointAdvanced",
    feedback: {guess: [..."ccccc"], feedback: ["grey", "grey", "grey", "grey", "grey"]},
    attempts: 5, isCorrect: false, gameOver: false, canContinue: true});
  render(state);
  state = gameSessionReducer(state, {type: "guessPreviewConfirmed"});
  render(state);
  expect(save.mock.calls.at(-1)?.[0]).toMatchObject({
    awaitingContinue: true, engineSnapshot: {attemptsUsed: 5},
    guesses: expect.arrayContaining([expect.objectContaining({guess: [..."ccccc"]})]),
  });
});
