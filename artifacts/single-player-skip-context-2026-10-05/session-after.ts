import {normalizeEconomyDifficulty} from "@qwordly/core/game";
import {getDailyDate} from "@qwordly/core/validation/dailyCalendar";
import {coerceToDate} from "../daily/dailyStreak";
import {countCoinRewardAchievements} from "@qwordly/core/game";
import {createHash, randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {splitGraphemes} from "@qwordly/core/game";
import type {
  GetHintRequestSchema,
  SubmitSinglePlayerGuessRequestData,
  SubmitSinglePlayerGuessResponseData,
} from "@qwordly/core/validation/requestSchemas";
import type {z} from "zod";
import type {Player, PlayerProgress} from "../validation/firestoreSchemas";
import {admin} from "../shared/firebaseAdmin";
import {
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
  CONTINUE_COST_COINS,
  HINT_COST_COINS,
  SKIP_COST_CLASSIC,
} from "../shared/constants";
import {findNewAchievements} from "./achievements";
import {recordTerminalCompletionBinding} from "./singlePlayerCompletionBinding";
import {
  assertSinglePlayerSessionActive,
  isSinglePlayerSessionExpired,
  sessionExpiry,
} from "./singlePlayerSessionExpiry";
import {baseAttemptLimit, normalizeAnswerText, transitionSinglePlayerGuess} from "./singlePlayerGuessTransition";
import type {
  AuthoritativeHintResult,
  AuthoritativeSkipResult,
  CommittedAuthoritativeSkipResult,
  SinglePlayerSessionState,
} from "./singlePlayerSessionTypes";
export {transitionSinglePlayerGuess} from "./singlePlayerGuessTransition";
export type {
  AuthoritativeHintResult,
  AuthoritativeSkipResult,
  GuessTransition,
  SinglePlayerSessionState,
} from "./singlePlayerSessionTypes";

/** Produces a fixed safe Firestore identifier or map key. */
const opaqueHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Resolves the private state document for one player's riddle. */
const getSessionRef = (userId: string, sessionToken: string) =>
  admin.firestore().collection("users").doc(userId).collection("singlePlayerSessions").doc(opaqueHash(sessionToken));

/** Resolves the private stable binding for one immutable content identity. */
const getBindingRef = (userId: string, contentKey: string) =>
  admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("singlePlayerSessionBindings")
    .doc(opaqueHash(contentKey));

/** Resolves the canonical completion receipt used to decide loss-session rotation. */
const getCompletionReceiptRef = (userId: string, gameMode: "classic" | "challenge", completionKey: string) =>
  admin
    .firestore()
    .collection("gameCompletionReceipts")
    .doc(opaqueHash(`${userId}\0${gameMode}\0${completionKey}`));

/** Issues or resumes one opaque session token for immutable canonical content. */
export async function ensureAuthoritativeSession(
  userId: string,
  gameMode: "classic" | "challenge",
  riddleId: string,
  locale: string,
  contentKey: string,
  completionKey: string,
  answer: string,
  entitlement: {
    /** Stores classic index. */
    classicIndex?: number; /** Stores challenge date. */
    /** Stores challenge date. */
    challengeDate?: string;
    /** Server-owned content difficulty; never accepted from gameplay requests. */
    difficultyBand?: unknown;
  },
): Promise<string> {
  /** Provides binding ref behavior. */
  const bindingRef = getBindingRef(userId, contentKey);
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides binding snapshot behavior. */
    const bindingSnapshot = await transaction.get(bindingRef);
    if (bindingSnapshot.exists) {
      /** Provides token behavior. */
      const token = bindingSnapshot.data()?.sessionToken;
      if (typeof token !== "string" || token.length < 20) {
        throw new HttpsError("internal", "The authoritative session binding is invalid.");
      }
      /** Provides existing session behavior. */
      const existingSession = await transaction.get(getSessionRef(userId, token));
      /** Provides existing state behavior. */
      const existingState = existingSession.data() as SinglePlayerSessionState | undefined;
      if (
        existingSession.exists &&
        existingState?.gameMode === gameMode &&
        existingState.riddleId === riddleId &&
        existingState.locale === locale &&
        existingState.contentKey === contentKey &&
        existingState.completionKey === completionKey &&
        existingState.answer === answer &&
        !isSinglePlayerSessionExpired(existingState)
      ) {
        if (existingState.terminal && !existingState.isCorrect && !existingState.isSkipped) {
          /** Provides loss receipt behavior. */
          const lossReceipt = await transaction.get(
            getCompletionReceiptRef(userId, gameMode, `${completionKey}:loss:${token}`),
          );
          if (!lossReceipt.exists || lossReceipt.data()?.status !== "completed") return token;
          // A fully recorded loss starts a fresh attempt on the same entitlement.
        } else {
          return token;
        }
      }
    }
    /** Provides session token behavior. */
    const sessionToken = randomUUID();
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, sessionToken);
    /** Provides expires at behavior. */
    const expiresAt = sessionExpiry();
    transaction.set(bindingRef, {
      sessionToken,
      gameMode,
      riddleId,
      locale,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });
    transaction.create(sessionRef, {
      gameMode,
      riddleId,
      contentKey,
      completionKey,
      locale,
      answer,
      ...entitlement,
      difficultyBand: normalizeEconomyDifficulty(entitlement.difficultyBand),
      attempts: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
      terminal: false,
      isCorrect: false,
      guessReceipts: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });
    return sessionToken;
  });
}

/** Ensures an opaque token is bound to exactly the expected user content. */
function assertSessionBinding(
  state: SinglePlayerSessionState | undefined,
  gameMode: "classic" | "challenge",
  riddleId: string,
  locale: string,
  contentKey: string,
): asserts state is SinglePlayerSessionState {
  if (
    !state ||
    state.gameMode !== gameMode ||
    state.riddleId !== riddleId ||
    state.locale !== locale ||
    state.contentKey !== contentKey
  ) {
    throw new HttpsError("permission-denied", "The game session does not match this canonical riddle.");
  }
}

/** Ensures an active session still represents the player's current entitlement. */
function assertCurrentEntitlement(
  state: SinglePlayerSessionState,
  user: FirebaseFirestore.DocumentData,
  now = new Date(),
): void {
  if (state.gameMode === "classic") {
    /** Provides current classic index behavior. */
    const currentClassicIndex = Number(user.progress?.classicIndex ?? 1);
    if (!Number.isInteger(state.classicIndex) || state.classicIndex !== currentClassicIndex) {
      throw new HttpsError("permission-denied", "This is not the player's current Classic riddle.");
    }
    return;
  }
  /** Provides today behavior. */
  const today = getDailyDate(state.locale, now);
  if (state.challengeDate !== today) {
    throw new HttpsError("permission-denied", "This daily challenge is no longer current.");
  }
  /** Provides last completed behavior. */
  const lastCompleted = user.lastDailyChallengeCompletedAt;
  /** Completes d date. */
  const completedAt = coerceToDate(lastCompleted);
  /** Completion date resolved under the authoritative play session’s locale. */
  const completedDate = user.lastCompletedDailyChallengeKey ?? (completedAt ? getDailyDate(state.locale, completedAt) : undefined);
  if (completedDate && completedDate >= today) {
    throw new HttpsError("failed-precondition", "Today's daily challenge is already complete.");
  }
}

/** Validates issued private state at both standalone reads and the atomic skip boundary. */
function assertIssuedSession(state: SinglePlayerSessionState, gameMode: "classic" | "challenge", riddleId: string): void {
  assertSinglePlayerSessionActive(state);
  if (
    state.gameMode !== gameMode ||
    state.riddleId !== riddleId ||
    typeof state.locale !== "string" ||
    typeof state.contentKey !== "string" ||
    typeof state.completionKey !== "string" ||
    typeof state.answer !== "string"
  ) {
    throw new HttpsError("permission-denied", "The game session does not match this riddle.");
  }
}

/** Reads locale/content binding from an opaque token owned by the authenticated user. */
export async function getIssuedAuthoritativeSession(
  userId: string,
  sessionToken: string,
  gameMode: "classic" | "challenge",
  riddleId: string,
): Promise<SinglePlayerSessionState> {
  /** Provides snapshot behavior. */
  const snapshot = await getSessionRef(userId, sessionToken).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "The game session is not valid.");
  /** Provides state behavior. */
  const state = snapshot.data() as SinglePlayerSessionState;
  assertIssuedSession(state, gameMode, riddleId);
  return state;
}

/** Persists one idempotent authoritative guess. */
export async function submitAuthoritativeGuess(
  userId: string,
  request: SubmitSinglePlayerGuessRequestData,
): Promise<SubmitSinglePlayerGuessResponseData> {
  /** Provides session ref behavior. */
  const sessionRef = getSessionRef(userId, request.sessionToken);
  /** Provides r ref. */
  const userRef = admin.firestore().collection("users").doc(userId);
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides [snapshot, user snapshot] behavior. */
    const [snapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
    /** Provides state behavior. */
    const state = snapshot.exists ? (snapshot.data() as SinglePlayerSessionState) : undefined;
    if (!userSnapshot.exists) throw new HttpsError("not-found", "User data not found.");
    if (!state) throw new HttpsError("permission-denied", "The game session is not valid.");
    assertSinglePlayerSessionActive(state);
    assertSessionBinding(state, request.gameMode, request.riddleId, state.locale, state.contentKey);
    if (!state.terminal) assertCurrentEntitlement(state, userSnapshot.data() ?? {});
    /** Provides transition behavior. */
    const transition = transitionSinglePlayerGuess({state, request, answer: state.answer, locale: state.locale});
    if (!transition.replayed) {
      if (transition.state.terminal && !state.terminal) {
        await recordTerminalCompletionBinding(transaction, userId, request.sessionToken, transition.state);
      }
      transaction.set(sessionRef, {
        ...transition.state,
        ...(transition.state.terminal && !state.terminal
          ? {
              terminalAt: admin.firestore.FieldValue.serverTimestamp(),
            }
          : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return transition.result;
  });
}

/** Marks a declined base-limit game as terminal before loss side effects run. */
export async function finalizeAuthoritativeSession(
  userId: string,
  gameMode: "classic" | "challenge",
  riddleId: string,
  sessionToken: string,
): Promise<SinglePlayerSessionState> {
  /** Provides session ref behavior. */
  const sessionRef = getSessionRef(userId, sessionToken);
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(sessionRef);
    if (!snapshot.exists) {
      throw new HttpsError("failed-precondition", "No authoritative attempts exist for this riddle.");
    }
    /** Provides state behavior. */
    const state = snapshot.data() as SinglePlayerSessionState;
    assertSinglePlayerSessionActive(state);
    assertSessionBinding(state, gameMode, riddleId, state.locale, state.contentKey);
    if (state.terminal) {
      await recordTerminalCompletionBinding(transaction, userId, sessionToken, state);
      return state;
    }
    if (!state.awaitingContinue || state.attempts < baseAttemptLimit(gameMode)) {
      throw new HttpsError("failed-precondition", "The game has not reached a terminal outcome.");
    }
    /** Provides terminal state behavior. */
    const terminalState = {...state, awaitingContinue: false, terminal: true, isCorrect: false};
    await recordTerminalCompletionBinding(transaction, userId, sessionToken, terminalState);
    transaction.set(sessionRef, {
      ...terminalState,
      terminalAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return terminalState;
  });
}

/** Atomically grants the one extra attempt; only a target-owned callable may waive its charge. */
export async function grantAuthoritativeContinue(
  userId: string,
  gameMode: "classic" | "challenge",
  riddleId: string,
  requestId: string,
  sessionToken: string,
  funding: "coins" | "facebook-rewarded" = "coins",
): Promise<number> {
  /** Provides session ref behavior. */
  const sessionRef = getSessionRef(userId, sessionToken);
  /** Provides r ref. */
  const userRef = admin.firestore().collection("users").doc(userId);
  /** Requests hash. */
  const requestHash = opaqueHash(requestId);
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides [session snapshot, user snapshot] behavior. */
    const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
    if (!sessionSnapshot.exists) {
      throw new HttpsError("failed-precondition", "No active riddle is awaiting a continue.");
    }
    if (!userSnapshot.exists) {
      throw new HttpsError("not-found", "User data not found.");
    }
    /** Provides state behavior. */
    const state = sessionSnapshot.data() as SinglePlayerSessionState;
    assertSinglePlayerSessionActive(state);
    assertSessionBinding(state, gameMode, riddleId, state.locale, state.contentKey);
    assertCurrentEntitlement(state, userSnapshot.data() ?? {});
    /** Provides coins behavior. */
    const coins = Number(userSnapshot.data()?.coins ?? 0);
    if (state.continueRequestHash === requestHash && state.hasUsedContinue) return coins;
    if (
      state.hasUsedContinue &&
      !state.terminal &&
      !state.awaitingContinue &&
      state.attempts === baseAttemptLimit(gameMode)
    ) {
      // Semantic retry recovery: a caller that lost the committed response may
      // use a fresh transport request id without being charged again.
      return coins;
    }
    if (state.terminal || !state.awaitingContinue || state.hasUsedContinue) {
      throw new HttpsError("failed-precondition", "This riddle is not eligible for another attempt.");
    }
    /** Server-selected continuation charge; ad-funded grants use the approved funding path. */
    const cost = funding === "facebook-rewarded" ? 0 : CONTINUE_COST_COINS;
    if (coins < cost) {
      throw new HttpsError("failed-precondition", "Insufficient coins to continue.");
    }
    /** Provides new coins behavior. */
    const newCoins = coins - cost;
    /** Provides continued state behavior. */
    const continuedState = {...state};
    delete continuedState.lastGuess;
    delete continuedState.lastGuessResult;
    if (cost > 0) transaction.update(userRef, {coins: newCoins});
    transaction.set(sessionRef, {
      ...continuedState,
      hasUsedContinue: true,
      awaitingContinue: false,
      continueRequestHash: requestHash,
      continueFunding: funding,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return newCoins;
  });
}

/** Atomically reveals and charges for one idempotent authoritative hint. */
export async function purchaseAuthoritativeHint(
  userId: string,
  request: z.infer<typeof GetHintRequestSchema>,
): Promise<AuthoritativeHintResult> {
  /** Provides session ref behavior. */
  const sessionRef = getSessionRef(userId, request.sessionToken);
  /** Provides r ref. */
  const userRef = admin.firestore().collection("users").doc(userId);
  /** Requests hash. */
  const requestHash = opaqueHash(request.requestId);
  /** Provides attempt hash behavior. */
  const attemptHash = opaqueHash(JSON.stringify(request.currentAttempt));
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides [session snapshot, user snapshot] behavior. */
    const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
    if (!sessionSnapshot.exists) throw new HttpsError("permission-denied", "The game session is not valid.");
    if (!userSnapshot.exists) throw new HttpsError("not-found", "User data not found.");
    /** Provides state behavior. */
    const state = sessionSnapshot.data() as SinglePlayerSessionState;
    assertSinglePlayerSessionActive(state);
    assertSessionBinding(state, request.gameMode, request.riddleId, state.locale, state.contentKey);
    /** Provides prior receipt behavior. */
    const priorReceipt = state.hintReceipts?.[requestHash];
    if (priorReceipt) {
      if (priorReceipt.attemptHash !== attemptHash) {
        throw new HttpsError("already-exists", "The hint request id was already used for different input.");
      }
      return priorReceipt.result;
    }
    if (state.lastHintAttemptHash === attemptHash && state.lastHintResult) return state.lastHintResult;
    if (state.terminal) throw new HttpsError("failed-precondition", "Game is already completed.");
    assertCurrentEntitlement(state, userSnapshot.data() ?? {});

    /** Provides answer letters behavior. */
    const answerLetters = splitGraphemes(normalizeAnswerText(state.answer, state.locale), state.locale);
    /** Provides guessed letters behavior. */
    const guessedLetters = request.currentAttempt.map((letter) => normalizeAnswerText(letter, state.locale));
    /** Provides revealed behavior. */
    const revealed = state.hintRevealedIndices ?? [];
    /** Provides index behavior. */
    const index = answerLetters.findIndex(
      (letter, candidate) => !revealed.includes(candidate) && guessedLetters[candidate] !== letter,
    );
    if (index < 0) return null;

    /** Provides r. */
    const user = userSnapshot.data() as Player;
    /** Provides coins behavior. */
    const coins = Number(user.coins ?? 0);
    if (coins < HINT_COST_COINS) {
      throw new HttpsError("failed-precondition", "Insufficient coins to get a hint.");
    }
    /** Provides stats behavior. */
    const stats = {...user.stats, totalHintsUsed: Number(user.stats?.totalHintsUsed ?? 0) + 1};
    /** Provides new achievements behavior. */
    const newAchievements = findNewAchievements(
      {...user, coins: coins - HINT_COST_COINS, stats},
      {gameMode: request.gameMode, isCorrect: false, attempts: state.attempts, gameOver: false},
    );
    /** Provides achievement coins behavior. */
    const achievementCoins = countCoinRewardAchievements(newAchievements.map((entry) => entry.achievementId)) * ACHIEVEMENT_UNLOCK_COIN_REWARD;
    /** Provides new coins behavior. */
    const newCoins = coins - HINT_COST_COINS + achievementCoins;
    /** Provides result behavior. */
    const result: Exclude<AuthoritativeHintResult, null> = {
      revealedLetter: answerLetters[index].toUpperCase(),
      index,
      coinsCost: HINT_COST_COINS,
      newCoins,
      ...(newAchievements.length
        ? {
            newlyUnlockedAchievementIds: newAchievements.map((entry) => entry.achievementId),
          }
        : {}),
    };
    transaction.update(userRef, {
      coins: newCoins,
      stats,
      unlockedAchievements: [...(user.unlockedAchievements ?? []), ...newAchievements],
    });
    transaction.set(sessionRef, {
      ...state,
      hintRevealedIndices: [...revealed, index],
      hintReceipts: {
        ...(state.hintReceipts ?? {}),
        [requestHash]: {attemptHash, result},
      },
      lastHintAttemptHash: attemptHash,
      lastHintResult: result,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return result;
  });
}

/** Atomically charges, advances, and receipts one authorized Classic skip. */
export async function skipAuthoritativeRiddle(
  userId: string,
  request: {
    /** Stores riddle id. */
    riddleId: string; /** Stores game mode. */
    /** Stores game mode. */
    gameMode: "classic"; /** Stores session token. */
    /** Stores session token. */
    sessionToken: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  },
): Promise<CommittedAuthoritativeSkipResult> {
  /** Provides session ref behavior. */
  const sessionRef = getSessionRef(userId, request.sessionToken);
  /** Provides r ref. */
  const userRef = admin.firestore().collection("users").doc(userId);
  /** Requests hash. */
  const requestHash = opaqueHash(request.requestId);
  return admin.firestore().runTransaction(async (transaction) => {
    /** Provides [session snapshot, user snapshot] behavior. */
    const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
    if (!sessionSnapshot.exists) throw new HttpsError("permission-denied", "The game session is not valid.");
    if (!userSnapshot.exists) throw new HttpsError("not-found", "User data not found.");
    /** Provides state behavior. */
    const state = sessionSnapshot.data() as SinglePlayerSessionState;
    assertIssuedSession(state, "classic", request.riddleId);
    /** The same fresh account snapshot supplies replay preparation without changing the immutable receipt. */
    const user = userSnapshot.data() as Player;
    if (state.skipResult) return {...state.skipResult, classicSupply: {classicIndex: Number(user.progress?.classicIndex ?? 1), locale: state.locale}};
    if (state.terminal) throw new HttpsError("failed-precondition", "This riddle is already complete.");
    assertCurrentEntitlement(state, user);
    /** Provides coins behavior. */
    const coins = Number(user.coins ?? 0);
    if (coins < SKIP_COST_CLASSIC) {
      throw new HttpsError("failed-precondition", "Insufficient coins to skip this riddle.");
    }
    /** Provides next classic index behavior. */
    const nextClassicIndex = Number(user.progress?.classicIndex ?? 1) + 1;
    /** Provides new progress behavior. */
    const newProgress: PlayerProgress = {
      classicIndex: nextClassicIndex,
      dailyChallengeIndex: user.progress?.dailyChallengeIndex ?? 0,
      dailyChallengeCurrentQuestion: user.progress?.dailyChallengeCurrentQuestion ?? 0,
    };
    /** Provides result behavior. */
    const result: AuthoritativeSkipResult = {
      newCoins: coins - SKIP_COST_CLASSIC,
      newProgress,
      costDeducted: SKIP_COST_CLASSIC,
    };
    transaction.update(userRef, {
      coins: result.newCoins,
      progress: newProgress,
      "stats.classicSkipped": Number((user.stats as Record<string, unknown>)?.classicSkipped ?? 0) + 1,
    });
    transaction.set(sessionRef, {
      ...state,
      terminal: true,
      awaitingContinue: false,
      isCorrect: false,
      isSkipped: true,
      skipRequestHash: requestHash,
      skipResult: result,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {...result, classicSupply: {classicIndex: newProgress.classicIndex, locale: state.locale}};
  });
}
