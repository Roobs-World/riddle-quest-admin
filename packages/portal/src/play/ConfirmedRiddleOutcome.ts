import type {BridgeRiddle} from "@riddle-quest/core/bridge";
import {splitGraphemes} from "@riddle-quest/core/game";
import type {GameSessionState} from "./gameSessionTypes";

/** Recovers wins and exhausted paid attempts from complete host feedback, independently of provider saves. */
export const getConfirmedRiddleOutcome = (riddle: BridgeRiddle): GameSessionState["lastOutcome"] => {
  /** Bounded proof validation stays independent of the full, lazily loaded bridge parser. */
  const history = riddle.acceptedGuesses;
  if (typeof riddle.hasUsedContinue !== "boolean" || !Number.isInteger(riddle.attemptsUsed) || riddle.attemptsUsed < 1 ||
    riddle.attemptsUsed > 5 + (riddle.hasUsedContinue ? 1 : 0) ||
    (riddle.hasUsedContinue && riddle.attemptsUsed < 5) || riddle.awaitingContinue !== false ||
    !Number.isInteger(riddle.answerLength) || riddle.answerLength < 1 || riddle.answerLength > 7 ||
    !Array.isArray(history) || history.length !== riddle.attemptsUsed) return null;
  /** Only the final accepted attempt can prove a win. */
  let isCorrect = false;
  for (let index = 0; index < history.length; index++) {
    /** Complete positional feedback must belong to its accepted attempt and issued answer width. */
    const row = history[index];
    if (!row || row.attempt !== index + 1 || !Array.isArray(row.feedback) || row.feedback.length !== riddle.answerLength ||
      row.feedback.some(cell => typeof cell?.letter !== "string" || cell.letter.length < 1 || cell.letter.length > 32 ||
        splitGraphemes(cell.letter).length !== 1 ||
        (cell.status !== "green" && cell.status !== "yellow" && cell.status !== "red"))) return null;
    /** No accepted guesses may follow a winning row. */
    const won = row.feedback.every(cell => cell.status === "green");
    if (won && index !== history.length - 1) return null;
    if (index === history.length - 1) isCorrect = won;
  }
  // Five wrong answers still leave a Continue decision; only six paid attempts prove exhaustion.
  if (!isCorrect && (!riddle.hasUsedContinue || riddle.attemptsUsed !== 6)) return null;
  /** Stable presentation identity follows the authority's accepted terminal result. */
  const kind = isCorrect ? "win" : "loss";
  return {
    id: `${riddle.sessionToken}-${kind}-${riddle.attemptsUsed}`,
    kind,
    riddleId: riddle.riddleId,
    gameMode: riddle.gameMode,
    sessionToken: riddle.sessionToken,
    attempts: riddle.attemptsUsed,
    isCorrect,
  };
};

/** Restricts victory presentation and successor promotion to a proven win. */
export const getConfirmedRiddleWin = (riddle: BridgeRiddle): GameSessionState["lastOutcome"] => {
  /** Shared terminal proof retains the stricter win-only contract for existing callers. */
  const outcome = getConfirmedRiddleOutcome(riddle);
  return outcome?.kind === "win" ? outcome : null;
};
