import {HttpsError} from "firebase-functions/v2/https";
import {createHash} from "node:crypto";

/** Maximum answer length supported by the current single-player keyboard. */
export const MAX_PLAYABLE_SINGLE_PLAYER_ANSWER_LENGTH = 7;

/** Indicates whether an existing riddle can be completed with the shipped keyboard. */
export const isPlayableSinglePlayerAnswer = (answer: unknown): answer is string =>
  typeof answer === "string" && /^[a-z]{1,7}$/i.test(answer);

/** Rejects canonical content that the current player input cannot submit. */
export function assertPlayableSinglePlayerAnswer(answer: unknown): asserts answer is string {
  if (!isPlayableSinglePlayerAnswer(answer)) {
    throw new HttpsError("failed-precondition", "This riddle is not compatible with the current game input.");
  }
}

/** Builds a rollover-safe identity for one canonical single-player riddle. */
export const getSinglePlayerContentKey = (
  riddle: {
    /** Stores riddle id. */
    riddleId: string; /** Stores answer. */
    /** Stores answer. */
    answer: string; /** Stores canonical key. */
    /** Stores canonical key. */
    canonicalKey?: string; /** Stores challenge key. */
    /** Stores challenge key. */
    challengeKey?: string;
  },
  gameMode: "classic" | "challenge",
  locale: string,
  now = new Date(),
): string => {
  /** Provides stable identity behavior. */
  const stableIdentity =
    gameMode === "challenge"
      ? (riddle.challengeKey ?? riddle.canonicalKey ?? `${riddle.riddleId}:${now.toISOString().slice(0, 10)}`)
      : (riddle.canonicalKey ?? riddle.riddleId);
  return createHash("sha256")
    .update(`${gameMode}\0${locale}\0${stableIdentity}\0${riddle.answer.normalize("NFC").toLocaleLowerCase(locale)}`)
    .digest("hex");
};

/** Builds the locale-independent entitlement key used to deduplicate rewards. */
export const getSinglePlayerCompletionKey = (gameMode: "classic" | "challenge", entitlement: number | string): string =>
  `${gameMode}:${String(entitlement)}`;
