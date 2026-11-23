import {type ScoredGuess} from "../../contracts/scoring";
import type {SavedGame} from "./savedGame";
import type {GameSessionAction, GameSessionState} from "../gameSessionTypes";
import {rejectHintPreview} from "../hintPreview";

/** Isolates adapter-owned checkpoint values from reducer-owned progress. */
const cloneGuesses = (guesses: ScoredGuess[]): ScoredGuess[] =>
  guesses.map(row => ({guess: [...row.guess], feedback: [...row.feedback]}));

/** Keeps retained drafts independent of adapter writes and reducer restoration. */
const cloneCheckpoint = (game: SavedGame): SavedGame => ({
  ...game,
  currentLetters: [...game.currentLetters],
  hintRevealedIndices: [...game.hintRevealedIndices],
  guesses: cloneGuesses(game.guesses),
  engineSnapshot: {...game.engineSnapshot, guesses: cloneGuesses(game.engineSnapshot.guesses)},
  letterStates: {...game.letterStates},
  ...(game.pendingOutcome ? {pendingOutcome: {...game.pendingOutcome}} : {}),
});


/** Immutable reducer fields read by createSavedGame, including speculative rollback inputs. */
const checkpointFields = [
  "riddle", "engineSnapshot", "lastOutcome", "completionAcknowledged", "gameMode",
  "currentLetters", "activeSlotIndex", "hintRevealedIndices", "guesses", "letterStates",
  "pendingGuessState", "pendingCoinSpend", "pendingHintState",
] as const satisfies readonly (keyof GameSessionState)[];

/** Projects an active game session into the versioned client-owned player-data snapshot. */
export const createSavedGame = (state: GameSessionState, savedAt = Date.now()): SavedGame | null => {
  if (state.pendingGuessState) state = {...state, ...state.pendingGuessState,
    draftRevision: state.pendingGuessState.draftRevision ?? state.draftRevision, pendingGuessState: null};
  if (state.pendingCoinSpend?.continueState &&
    state.riddle?.sessionToken === state.pendingCoinSpend.sessionToken) {
    state = {...state, ...state.pendingCoinSpend.continueState,
      draftRevision: state.pendingCoinSpend.continueState.draftRevision ?? state.draftRevision};
  }
  if (state.pendingHintState) state = rejectHintPreview(state);
  if (!state.riddle || !state.engineSnapshot || (state.lastOutcome && state.completionAcknowledged)) return null;
  return {
    schemaVersion: 1,
    savedAt,
    draftRevision: state.draftRevision,
    riddleId: state.riddle.riddleId,
    gameMode: state.gameMode,
    sessionToken: state.riddle.sessionToken,
    currentLetters: [...state.currentLetters],
    activeSlotIndex: state.activeSlotIndex,
    hintRevealedIndices: [...state.hintRevealedIndices],
    guesses: cloneGuesses(state.guesses),
    engineSnapshot: {...state.engineSnapshot, guesses: cloneGuesses(state.engineSnapshot.guesses)},
    awaitingContinue:
      !state.engineSnapshot.gameOver &&
      !state.engineSnapshot.hasUsedContinue &&
      state.engineSnapshot.attemptsUsed === 5,
    letterStates: {...state.letterStates},
    ...(state.lastOutcome ? {pendingOutcome: {...state.lastOutcome}} : {}),
  };
};

/** Decisions delivered by the React adapter after one complete checkpoint transition. */
export type GameSessionCheckpointEffect =
  | {
      /** Matching authority-issued riddle requires one restore. */ kind: "restore";
      /** Restoration is still validated by the game-session reducer. */ action: GameSessionAction;
    }
  | {
      /** Confirmed progress changed or an acknowledged outcome must be cleared. */ kind: "save";
      /** Client projection; null clears completed progress. */ game: SavedGame | null;
    };

/** Owns restoration, confirmed projections, duplicate suppression and background checkpoints. */
export class GameSessionCheckpoints {
  /** Initial observation consumes restoration even when no matching saved progress exists. */
  private observedRiddle: GameSessionState["riddle"] = null;
  /** Only one clear is emitted per acknowledged terminal outcome. */
  private clearedOutcome: string | null = null;
  /** Complete payload fingerprint includes session identity, feedback and terminal state. */
  private signature: string | null = null;
  /** Identity for the baseline supplied when authority loads a question. */
  private sessionToken: string | null = null;
  /** Recent issued sessions keep their latest confirmed drafts during locale changes. */
  private drafts = new Map<string, SavedGame>();
  /** A different account generation must never inherit retained drafts. */
  private owner: string | null = null;

  /** Last immutable inputs avoid cloning and serializing presentation-only updates. */
  private progressState: GameSessionState | null = null;

  /** Returns one ordered restore/save decision; background saves bypass duplicate suppression. */
  update(state: GameSessionState, restoredGame?: SavedGame | null, background = false): GameSessionCheckpointEffect | null {
    /** Account ownership is independent of refreshed profile object identities. */
    const owner = `${state.user?.uid ?? ""}\u0000${state.user?.accountGeneration ?? ""}`;
    if (this.owner !== owner) {
      this.owner = owner;
      this.drafts.clear();
      this.observedRiddle = null;
      this.sessionToken = null;
      this.signature = null;
      this.clearedOutcome = null;
      this.progressState = null;
    }
    if (state.riddle && this.observedRiddle !== state.riddle) {
      this.observedRiddle = state.riddle;
      /** Current-session drafts take precedence over the startup-only provider snapshot. */
      const retained = this.drafts.get(state.riddle.sessionToken) ?? restoredGame;
      if (!background && state.canRestoreCheckpoint && !state.lastOutcome && retained?.riddleId === state.riddle.riddleId &&
        retained.sessionToken === state.riddle.sessionToken) {
        /** Restoration must update the provider's active checkpoint before a later reload. */
        this.sessionToken = state.riddle.sessionToken;
        /** Isolated checkpoint values transferred into the restored session. */
        const restored = cloneCheckpoint(retained);
        return {kind: "restore", action: {
          type: "restoreSession", riddleId: restored.riddleId, sessionToken: restored.sessionToken,
          draftRevision: restored.draftRevision,
          currentLetters: restored.currentLetters,
          activeSlotIndex: restored.activeSlotIndex, hintRevealedIndices: restored.hintRevealedIndices,
          guesses: restored.guesses, engineSnapshot: restored.engineSnapshot,
          awaitingContinue: restored.awaitingContinue, letterStates: restored.letterStates,
          pendingOutcome: restored.pendingOutcome,
        }};
      }
    }
    if (state.lastOutcome && state.completionAcknowledged) {
      if (this.clearedOutcome === state.lastOutcome.id) return null;
      this.clearedOutcome = state.lastOutcome.id;
      if (state.riddle) this.drafts.delete(state.riddle.sessionToken);
      return {kind: "save", game: null};
    }
    /** Background checkpoints still produce a fresh isolated snapshot for the adapter. */
    const previous = this.progressState;
    if (!background && previous &&
      checkpointFields.every(field => previous[field] === state[field])) return null;
    /** Only confirmed gameplay reaches durable target storage. */
    const game = createSavedGame(state);
    if (!game) return null;
    this.drafts.delete(game.sessionToken);
    this.drafts.set(game.sessionToken, cloneCheckpoint(game));
    /** Bound retention independently of how many locales or questions are visited. */
    if (this.drafts.size > 32) this.drafts.delete(this.drafts.keys().next().value!);
    this.progressState = state;
    /** Save time changes alone do not create a new checkpoint. */
    const signature = JSON.stringify({...game, savedAt: 0});
    /** A newly issued question is already held by authority; subsequent changes need checkpoints. */
    const baseline = this.sessionToken !== game.sessionToken;
    /** Whether the complete checkpoint payload changed. */
    const changed = this.signature !== signature;
    this.sessionToken = game.sessionToken;
    this.signature = signature;
    // An authority-recovered win still needs its completion intent saved before acknowledgement.
    return background || (changed && (!baseline || Boolean(game.pendingOutcome))) ? {kind: "save", game} : null;
  }
}
