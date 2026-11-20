import type {GameSessionState} from "./gameSessionTypes";

/** Records admitted player input independently of resulting letter or cursor equality. */
export const markHintPreviewIntent = (preview: GameSessionState["pendingHintState"]): GameSessionState["pendingHintState"] =>
  preview && !preview.hasPlayerIntent ? {...preview, hasPlayerIntent: true} : preview;

/** Removes an unconfirmed hint while retaining typing and selection made after its preview. */
export const rejectHintPreview = (state: GameSessionState): GameSessionState => {
  /** Only the current preview owns a letter to roll back. */
  const preview = state.pendingHintState;
  if (!preview) return state;
  /** Restore the replaced letter without discarding subsequent edits. */
  const currentLetters = [...state.currentLetters];
  currentLetters[preview.index] = preview.previousLetter;
  /** Removing the provisional lock leaves every confirmed hint intact. */
  const hintRevealedIndices = state.hintRevealedIndices.filter(index => index !== preview.index);
  /** Untouched previews restore the original cursor; later player intent retains its current cursor. */
  const selected = preview.hasPlayerIntent
    ? state.activeSlotIndex : preview.previousActiveSlotIndex;
  /** A restored cursor must never point at a remaining confirmed hint when an editable cell exists. */
  const activeSlotIndex = hintRevealedIndices.includes(selected)
    ? currentLetters.findIndex((letter, index) => !letter && !hintRevealedIndices.includes(index))
    : selected;
  return {...state, currentLetters, hintRevealedIndices,
    activeSlotIndex: activeSlotIndex >= 0 ? activeSlotIndex :
      Math.max(0, currentLetters.findIndex((_letter, index) => !hintRevealedIndices.includes(index))),
    pendingHintState: null};
};
