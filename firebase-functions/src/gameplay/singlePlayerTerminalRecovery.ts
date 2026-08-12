import {completeAuthoritativeGame, isDailyCompletionDateEligible} from "./completeGameLogic";
import {getCompletionBoundAuthoritativeSession} from "./singlePlayerCompletionBinding";

/** Parses a trusted Firestore terminal timestamp. */
const trustedTerminalDate = (value: unknown): Date | undefined => {
  if (typeof value !== "object" || value === null || !("toDate" in value) || typeof value.toDate !== "function") {
    return undefined;
  }
  const parsed = value.toDate();
  return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
};

/** Replays one server-proven pending terminal completion without a client resume token. */
export async function recoverPendingAuthoritativeCompletion(
  userId: string,
  gameMode: "classic" | "challenge",
  completionKey: string,
  isAnonymous: boolean,
  now = new Date(),
): Promise<boolean> {
  const bound = await getCompletionBoundAuthoritativeSession(userId, gameMode, completionKey);
  if (!bound || !bound.state.terminal || bound.state.isSkipped) return false;
  if (gameMode === "challenge" && !isDailyCompletionDateEligible(
    bound.state.challengeDate,
    bound.state.isCorrect,
    trustedTerminalDate(bound.state.terminalAt),
    now,
  )) return false;
  await completeAuthoritativeGame(
    {riddleId: bound.state.riddleId, gameMode, sessionToken: bound.sessionToken},
    {uid: userId, isAnonymous},
  );
  return true;
}
