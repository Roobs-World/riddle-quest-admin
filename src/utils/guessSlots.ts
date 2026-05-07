export function isLockedGuessSlot(
  slotIndex: number,
  lockedSlotIndices: readonly number[]
): boolean {
  return lockedSlotIndices.includes(slotIndex);
}

export function findNextEditableGuessSlot(
  startIndex: number,
  answerLength: number,
  lockedSlotIndices: readonly number[]
): number | null {
  for (let i = Math.max(0, startIndex); i < answerLength; i++) {
    if (!isLockedGuessSlot(i, lockedSlotIndices)) {
      return i;
    }
  }

  return null;
}

export function findPreviousEditableGuessSlot(
  startIndex: number,
  lockedSlotIndices: readonly number[]
): number | null {
  for (let i = startIndex; i >= 0; i--) {
    if (!isLockedGuessSlot(i, lockedSlotIndices)) {
      return i;
    }
  }

  return null;
}

export function resolveEditableGuessSlot(
  requestedSlotIndex: number,
  answerLength: number,
  lockedSlotIndices: readonly number[]
): number | null {
  if (answerLength <= 0) {
    return null;
  }

  const clampedSlotIndex = Math.min(
    Math.max(0, requestedSlotIndex),
    answerLength - 1
  );

  if (!isLockedGuessSlot(clampedSlotIndex, lockedSlotIndices)) {
    return clampedSlotIndex;
  }

  return (
    findNextEditableGuessSlot(
      clampedSlotIndex + 1,
      answerLength,
      lockedSlotIndices
    ) ?? findPreviousEditableGuessSlot(clampedSlotIndex - 1, lockedSlotIndices)
  );
}

export function resolveNextActiveGuessSlot(
  enteredSlotIndex: number,
  answerLength: number,
  lockedSlotIndices: readonly number[]
): number {
  return (
    findNextEditableGuessSlot(
      enteredSlotIndex + 1,
      answerLength,
      lockedSlotIndices
    ) ?? enteredSlotIndex
  );
}

export function resolveBackspaceGuessSlot(
  activeSlotIndex: number,
  currentGuess: readonly string[],
  answerLength: number,
  lockedSlotIndices: readonly number[]
): number | null {
  if (answerLength <= 0 || currentGuess.length === 0) {
    return null;
  }

  const clampedSlotIndex = Math.min(
    Math.max(0, activeSlotIndex),
    answerLength - 1
  );

  if (
    !isLockedGuessSlot(clampedSlotIndex, lockedSlotIndices) &&
    currentGuess[clampedSlotIndex]
  ) {
    return clampedSlotIndex;
  }

  return findPreviousEditableGuessSlot(
    clampedSlotIndex - 1,
    lockedSlotIndices
  );
}
