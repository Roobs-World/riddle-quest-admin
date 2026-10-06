import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";
import {isSinglePlayerSessionExpired, sessionExpiry} from "./singlePlayerSessionExpiry";

/** Produces a fixed Firestore identifier without exposing canonical entitlement data. */
const opaqueHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Resolves a private session document owned by one player. */
const getSessionRef = (userId: string, sessionToken: string) =>
  admin.firestore().collection("users").doc(userId).collection("singlePlayerSessions").doc(opaqueHash(sessionToken));

/** Resolves the locale-independent pending terminal pointer for one entitlement. */
export const getSinglePlayerCompletionBindingRef = (
  userId: string,
  gameMode: "classic" | "challenge",
  completionKey: string,
) =>
  admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("singlePlayerCompletionBindings")
    .doc(opaqueHash(`${gameMode}\0${completionKey}`));

/** Describes the non-answer-bearing fields stored in a pending terminal pointer. */
type CompletionBinding = {
  /** Opaque private session identity. */ sessionToken: string;
  /** Bound game mode. */ gameMode: "classic" | "challenge";
  /** Locale-independent entitlement identity. */ completionKey: string;
  /** Canonical riddle identity. */ riddleId: string;
  /** Indicates the referenced session is terminal. */ terminal: true;
  /** Indicates the terminal session is a win. */ isCorrect: boolean;
};

/** Returns a validated pending pointer or fails closed on corrupted private state. */
const parseCompletionBinding = (value: unknown): CompletionBinding => {
  /** Provides data behavior. */
  const data = value as Partial<CompletionBinding> | undefined;
  if (
    !data ||
    typeof data.sessionToken !== "string" ||
    data.sessionToken.length < 20 ||
    data.sessionToken.length > 128 ||
    (data.gameMode !== "classic" && data.gameMode !== "challenge") ||
    typeof data.completionKey !== "string" ||
    !data.completionKey ||
    typeof data.riddleId !== "string" ||
    !data.riddleId ||
    data.terminal !== true ||
    typeof data.isCorrect !== "boolean"
  ) {
    throw new HttpsError("internal", "The pending game completion binding is invalid.");
  }
  return data as CompletionBinding;
};

/**
 * Records a terminal pointer in the same transaction as the session state.
 * A proven win cannot be masked by a later loss or a newly issued active locale.
 */
export async function recordTerminalCompletionBinding(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  sessionToken: string,
  state: SinglePlayerSessionState,
): Promise<void> {
  if (!state.terminal) throw new HttpsError("internal", "Only terminal sessions can be bound for recovery.");
  /** Provides binding ref behavior. */
  const bindingRef = getSinglePlayerCompletionBindingRef(userId, state.gameMode, state.completionKey);
  /** Provides snapshot behavior. */
  const snapshot = await transaction.get(bindingRef);
  if (snapshot.exists) {
    /** Provides existing behavior. */
    const existing = parseCompletionBinding(snapshot.data());
    if (existing.gameMode !== state.gameMode || existing.completionKey !== state.completionKey) {
      throw new HttpsError("internal", "The pending game completion binding does not match its entitlement.");
    }
    if (existing.sessionToken !== sessionToken && (existing.isCorrect || !state.isCorrect)) return;
  }
  transaction.set(bindingRef, {
    sessionToken,
    gameMode: state.gameMode,
    completionKey: state.completionKey,
    riddleId: state.riddleId,
    terminal: true,
    isCorrect: state.isCorrect,
    terminalAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: sessionExpiry(),
  });
}

/**
 * Reports whether {@link recordTerminalCompletionBinding} would leave the pointer as it already is.
 *
 * Lets a read-only caller skip a locking transaction when the terminal guess
 * already bound this session. Any mismatch or corruption returns false so the
 * read-write path keeps sole ownership of repairs and failures.
 */
export async function terminalCompletionBindingSettled(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  sessionToken: string,
  state: SinglePlayerSessionState,
): Promise<boolean> {
  if (!state.terminal) return false;
  /** Pointer the read-write path would otherwise rewrite. */
  const snapshot = await transaction.get(getSinglePlayerCompletionBindingRef(userId, state.gameMode, state.completionKey));
  if (!snapshot.exists) return false;
  /** Stored pointer, or undefined when the read-write path must fail closed. */
  let existing: CompletionBinding;
  try {
    existing = parseCompletionBinding(snapshot.data());
  } catch {
    return false;
  }
  if (existing.gameMode !== state.gameMode || existing.completionKey !== state.completionKey) return false;
  if (existing.sessionToken !== sessionToken) return existing.isCorrect || !state.isCorrect;
  return existing.riddleId === state.riddleId && existing.isCorrect === state.isCorrect;
}

/** Loads a locale-independent terminal session without querying answer-bearing documents. */
export async function getCompletionBoundAuthoritativeSession(
  userId: string,
  gameMode: "classic" | "challenge",
  completionKey: string,
): Promise<
  | {
      /** Stores session token. */
      sessionToken: string; /** Stores state. */
      /** Stores state. */
      state: SinglePlayerSessionState;
    }
  | undefined
> {
  /** Provides binding snapshot behavior. */
  const bindingSnapshot = await getSinglePlayerCompletionBindingRef(userId, gameMode, completionKey).get();
  if (!bindingSnapshot.exists) return undefined;
  /** Provides binding behavior. */
  const binding = parseCompletionBinding(bindingSnapshot.data());
  if (binding.gameMode !== gameMode || binding.completionKey !== completionKey) {
    throw new HttpsError("permission-denied", "The pending game completion does not match this entitlement.");
  }
  /** Provides session snapshot behavior. */
  const sessionSnapshot = await getSessionRef(userId, binding.sessionToken).get();
  if (!sessionSnapshot.exists) return undefined;
  /** Provides state behavior. */
  const state = sessionSnapshot.data() as SinglePlayerSessionState;
  if (isSinglePlayerSessionExpired(state)) return undefined;
  if (
    state.gameMode !== binding.gameMode ||
    state.completionKey !== binding.completionKey ||
    state.riddleId !== binding.riddleId ||
    !state.terminal ||
    state.isCorrect !== binding.isCorrect
  ) {
    throw new HttpsError("permission-denied", "The pending game completion session is invalid.");
  }
  return {sessionToken: binding.sessionToken, state};
}

/** Checks whether a pointer belongs to the exact completion being committed. */
export function completionBindingMatches(
  value: unknown,
  expected: Pick<CompletionBinding, "sessionToken" | "gameMode" | "completionKey" | "riddleId">,
): boolean {
  try {
    /** Provides binding behavior. */
    const binding = parseCompletionBinding(value);
    return (
      binding.sessionToken === expected.sessionToken &&
      binding.gameMode === expected.gameMode &&
      binding.completionKey === expected.completionKey &&
      binding.riddleId === expected.riddleId
    );
  } catch {
    return false;
  }
}
