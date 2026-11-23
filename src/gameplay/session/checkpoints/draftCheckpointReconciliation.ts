import type {SavedGame} from "./savedGame";
import type {PendingGuessJournal} from "../journal/pendingGuessJournal";

/** Only a strictly newer, compatible draft may supersede a journal without deliveries. */
export function preferProviderDraft(journal: PendingGuessJournal, saved: SavedGame | null | undefined): boolean {
  if (!saved || journal.queue.length || journal.coinAction || journal.skipPreview || journal.successors.length ||
    saved.pendingOutcome || saved.engineSnapshot.gameOver ||
    saved.riddleId !== journal.riddle.riddleId || saved.sessionToken !== journal.riddle.sessionToken ||
    saved.gameMode !== journal.riddle.gameMode ||
    saved.engineSnapshot.attemptsUsed !== journal.base.engineSnapshot?.attemptsUsed ||
    saved.engineSnapshot.hasUsedContinue !== journal.base.engineSnapshot?.hasUsedContinue ||
    !Array.isArray(journal.base.guesses) || saved.guesses.length !== journal.base.guesses.length ||
    saved.guesses.some((guess, index) => JSON.stringify(guess) !== JSON.stringify(journal.base.guesses[index]))) return false;
  /** Different lineages and equal revisions cannot prove newer input. */
  const previous = journal.draftRevision, next = saved.draftRevision;
  if (!previous || !next || previous.origin !== next.origin || next.sequence <= previous.sequence) return false;
  /** Confirmed purchased letters must survive source selection. */
  const hints = journal.riddle.revealedHints ?? [];
  return saved.hintRevealedIndices.length === hints.length && hints.every(hint =>
    saved.hintRevealedIndices.includes(hint.index) && saved.currentLetters[hint.index] === hint.letter);
}
