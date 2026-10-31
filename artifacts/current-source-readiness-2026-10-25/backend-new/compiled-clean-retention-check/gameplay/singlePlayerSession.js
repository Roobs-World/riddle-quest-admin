"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionSinglePlayerGuess = void 0;
exports.ensureAuthoritativeSession = ensureAuthoritativeSession;
exports.ensureAuthoritativeSessionWithState = ensureAuthoritativeSessionWithState;
exports.getIssuedAuthoritativeSession = getIssuedAuthoritativeSession;
exports.submitAuthoritativeGuess = submitAuthoritativeGuess;
exports.finalizeAuthoritativeSession = finalizeAuthoritativeSession;
exports.grantAuthoritativeContinue = grantAuthoritativeContinue;
exports.purchaseAuthoritativeHint = purchaseAuthoritativeHint;
exports.skipAuthoritativeRiddle = skipAuthoritativeRiddle;
const game_1 = require("@qwordly/core/game");
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const dailyStreak_1 = require("../daily/dailyStreak");
const game_2 = require("@qwordly/core/game");
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const game_3 = require("@qwordly/core/game");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const constants_1 = require("../shared/constants");
const achievements_1 = require("./achievements");
const singlePlayerCompletionBinding_1 = require("./singlePlayerCompletionBinding");
const singlePlayerSessionExpiry_1 = require("./singlePlayerSessionExpiry");
const singlePlayerGuessTransition_1 = require("./singlePlayerGuessTransition");
var singlePlayerGuessTransition_2 = require("./singlePlayerGuessTransition");
Object.defineProperty(exports, "transitionSinglePlayerGuess", { enumerable: true, get: function () { return singlePlayerGuessTransition_2.transitionSinglePlayerGuess; } });
/** Produces a fixed safe Firestore identifier or map key. */
const opaqueHash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
/** Resolves the private state document for one player's riddle. */
const getSessionRef = (userId, sessionToken) => firebaseAdmin_1.admin.firestore().collection("users").doc(userId).collection("singlePlayerSessions").doc(opaqueHash(sessionToken));
/** Resolves the private stable binding for one immutable content identity. */
const getBindingRef = (userId, contentKey) => firebaseAdmin_1.admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("singlePlayerSessionBindings")
    .doc(opaqueHash(contentKey));
/** Resolves the canonical completion receipt used to decide loss-session rotation. */
const getCompletionReceiptRef = (userId, gameMode, completionKey) => firebaseAdmin_1.admin
    .firestore()
    .collection("gameCompletionReceipts")
    .doc(opaqueHash(`${userId}\0${gameMode}\0${completionKey}`));
/** Preserves token-only issuance for callers that separately reconcile current session state. */
async function ensureAuthoritativeSession(...args) {
    return (await ensureAuthoritativeSessionWithState(...args)).sessionToken;
}
/** Issues or resumes canonical state inside the same transaction that selects its opaque token. */
async function ensureAuthoritativeSessionWithState(userId, gameMode, riddleId, locale, contentKey, completionKey, answer, entitlement) {
    /** Provides binding ref behavior. */
    const bindingRef = getBindingRef(userId, contentKey);
    /** Only the final committed attempt can provide projection inputs. */
    const issued = await firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
        /** Provides binding snapshot behavior. */
        const bindingSnapshot = await transaction.get(bindingRef);
        if (bindingSnapshot.exists) {
            /** Provides token behavior. */
            const token = bindingSnapshot.data()?.sessionToken;
            if (typeof token !== "string" || token.length < 20) {
                throw new https_1.HttpsError("internal", "The authoritative session binding is invalid.");
            }
            /** Provides existing session behavior. */
            const existingSession = await transaction.get(getSessionRef(userId, token));
            /** Provides existing state behavior. */
            const existingState = existingSession.data();
            if (existingSession.exists &&
                existingState?.gameMode === gameMode &&
                existingState.riddleId === riddleId &&
                existingState.locale === locale &&
                existingState.contentKey === contentKey &&
                existingState.completionKey === completionKey &&
                existingState.answer === answer &&
                !(0, singlePlayerSessionExpiry_1.isSinglePlayerSessionExpired)(existingState)) {
                if (existingState.terminal && !existingState.isCorrect && !existingState.isSkipped) {
                    /** Provides loss receipt behavior. */
                    const lossReceipt = await transaction.get(getCompletionReceiptRef(userId, gameMode, `${completionKey}:loss:${token}`));
                    if (!lossReceipt.exists || lossReceipt.data()?.status !== "completed")
                        return { sessionToken: token, state: existingState };
                    // A fully recorded loss starts a fresh attempt on the same entitlement.
                }
                else {
                    return { sessionToken: token, state: existingState };
                }
            }
        }
        /** Provides session token behavior. */
        const sessionToken = (0, node_crypto_1.randomUUID)();
        /** Provides session ref behavior. */
        const sessionRef = getSessionRef(userId, sessionToken);
        /** Provides expires at behavior. */
        const expiresAt = (0, singlePlayerSessionExpiry_1.sessionExpiry)();
        transaction.set(bindingRef, {
            sessionToken,
            gameMode,
            riddleId,
            locale,
            createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            expiresAt,
        });
        /** Public projection inputs come from this attempt without an additional document read. */
        const state = {
            gameMode,
            riddleId,
            contentKey,
            completionKey,
            locale,
            answer,
            ...entitlement,
            difficultyBand: (0, game_1.normalizeEconomyDifficulty)(entitlement.difficultyBand),
            attempts: 0,
            hasUsedContinue: false,
            awaitingContinue: false,
            terminal: false,
            isCorrect: false,
            guessReceipts: {},
            expiresAt,
        };
        transaction.create(sessionRef, { ...state, createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(), updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() });
        return { sessionToken, state };
    });
    assertIssuedSession(issued.state, gameMode, riddleId);
    return issued;
}
/** Ensures an opaque token is bound to exactly the expected user content. */
function assertSessionBinding(state, gameMode, riddleId, locale, contentKey) {
    if (!state ||
        state.gameMode !== gameMode ||
        state.riddleId !== riddleId ||
        state.locale !== locale ||
        state.contentKey !== contentKey) {
        throw new https_1.HttpsError("permission-denied", "The game session does not match this canonical riddle.");
    }
}
/** Ensures an active session still represents the player's current entitlement. */
function assertCurrentEntitlement(state, user, now = new Date()) {
    if (state.gameMode === "classic") {
        /** Provides current classic index behavior. */
        const currentClassicIndex = Number(user.progress?.classicIndex ?? 1);
        if (!Number.isInteger(state.classicIndex) || state.classicIndex !== currentClassicIndex) {
            throw new https_1.HttpsError("permission-denied", "This is not the player's current Classic riddle.");
        }
        return;
    }
    /** Provides today behavior. */
    const today = (0, dailyCalendar_1.getDailyDate)(state.locale, now);
    if (state.challengeDate !== today) {
        throw new https_1.HttpsError("permission-denied", "This daily challenge is no longer current.");
    }
    /** Provides last completed behavior. */
    const lastCompleted = user.lastDailyChallengeCompletedAt;
    /** Completes d date. */
    const completedAt = (0, dailyStreak_1.coerceToDate)(lastCompleted);
    /** Completion date resolved under the authoritative play session’s locale. */
    const completedDate = user.lastCompletedDailyChallengeKey ?? (completedAt ? (0, dailyCalendar_1.getDailyDate)(state.locale, completedAt) : undefined);
    if (completedDate && completedDate >= today) {
        throw new https_1.HttpsError("failed-precondition", "Today's daily challenge is already complete.");
    }
}
/** Validates issued private state at both standalone reads and the atomic skip boundary. */
function assertIssuedSession(state, gameMode, riddleId) {
    (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
    if (state.gameMode !== gameMode ||
        state.riddleId !== riddleId ||
        typeof state.locale !== "string" ||
        typeof state.contentKey !== "string" ||
        typeof state.completionKey !== "string" ||
        typeof state.answer !== "string") {
        throw new https_1.HttpsError("permission-denied", "The game session does not match this riddle.");
    }
}
/** Reads locale/content binding from an opaque token owned by the authenticated user. */
async function getIssuedAuthoritativeSession(userId, sessionToken, gameMode, riddleId) {
    /** Provides snapshot behavior. */
    const snapshot = await getSessionRef(userId, sessionToken).get();
    if (!snapshot.exists)
        throw new https_1.HttpsError("permission-denied", "The game session is not valid.");
    /** Provides state behavior. */
    const state = snapshot.data();
    assertIssuedSession(state, gameMode, riddleId);
    return state;
}
/** Persists one idempotent authoritative guess. */
async function submitAuthoritativeGuess(userId, request) {
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, request.sessionToken);
    /** Provides r ref. */
    const userRef = firebaseAdmin_1.admin.firestore().collection("users").doc(userId);
    return firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
        /** Provides [snapshot, user snapshot] behavior. */
        const [snapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
        /** Provides state behavior. */
        const state = snapshot.exists ? snapshot.data() : undefined;
        if (!userSnapshot.exists)
            throw new https_1.HttpsError("not-found", "User data not found.");
        if (!state)
            throw new https_1.HttpsError("permission-denied", "The game session is not valid.");
        (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
        assertSessionBinding(state, request.gameMode, request.riddleId, state.locale, state.contentKey);
        if (!state.terminal)
            assertCurrentEntitlement(state, userSnapshot.data() ?? {});
        /** Provides transition behavior. */
        const transition = (0, singlePlayerGuessTransition_1.transitionSinglePlayerGuess)({ state, request, answer: state.answer, locale: state.locale });
        if (!transition.replayed) {
            if (transition.state.terminal && !state.terminal) {
                await (0, singlePlayerCompletionBinding_1.recordTerminalCompletionBinding)(transaction, userId, request.sessionToken, transition.state);
            }
            transaction.set(sessionRef, {
                ...transition.state,
                ...(transition.state.terminal && !state.terminal
                    ? {
                        terminalAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                    }
                    : {}),
                updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return transition.result;
    });
}
/** Marks a declined base-limit game as terminal before loss side effects run. */
async function finalizeAuthoritativeSession(userId, gameMode, riddleId, sessionToken) {
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, sessionToken);
    /** Firestore handle shared by the lock-free probe and the authoritative path. */
    const db = firebaseAdmin_1.admin.firestore();
    // A terminal guess has already committed the session and its pointer, so the
    // common completion path needs no locks and no commit round trip.
    /** Terminal state already fully recorded, read from one consistent snapshot. */
    const settled = await db.runTransaction(async (transaction) => {
        /** Session as of the read-only snapshot. */
        const snapshot = await transaction.get(sessionRef);
        if (!snapshot.exists)
            return undefined;
        /** Stored session state. */
        const state = snapshot.data();
        if (!state.terminal)
            return undefined;
        (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
        assertSessionBinding(state, gameMode, riddleId, state.locale, state.contentKey);
        return await (0, singlePlayerCompletionBinding_1.terminalCompletionBindingSettled)(transaction, userId, sessionToken, state) ? state : undefined;
    }, { readOnly: true });
    if (settled)
        return settled;
    return db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(sessionRef);
        if (!snapshot.exists) {
            throw new https_1.HttpsError("failed-precondition", "No authoritative attempts exist for this riddle.");
        }
        /** Provides state behavior. */
        const state = snapshot.data();
        (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
        assertSessionBinding(state, gameMode, riddleId, state.locale, state.contentKey);
        if (state.terminal) {
            await (0, singlePlayerCompletionBinding_1.recordTerminalCompletionBinding)(transaction, userId, sessionToken, state);
            return state;
        }
        if (!state.awaitingContinue || state.attempts < (0, singlePlayerGuessTransition_1.baseAttemptLimit)(gameMode)) {
            throw new https_1.HttpsError("failed-precondition", "The game has not reached a terminal outcome.");
        }
        /** Provides terminal state behavior. */
        const terminalState = { ...state, awaitingContinue: false, terminal: true, isCorrect: false };
        await (0, singlePlayerCompletionBinding_1.recordTerminalCompletionBinding)(transaction, userId, sessionToken, terminalState);
        transaction.set(sessionRef, {
            ...terminalState,
            terminalAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        return terminalState;
    });
}
/** Atomically grants the one extra attempt; only a target-owned callable may waive its charge. */
async function grantAuthoritativeContinue(userId, gameMode, riddleId, requestId, sessionToken, funding = "coins") {
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, sessionToken);
    /** Provides r ref. */
    const userRef = firebaseAdmin_1.admin.firestore().collection("users").doc(userId);
    /** Requests hash. */
    const requestHash = opaqueHash(requestId);
    return firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
        /** Provides [session snapshot, user snapshot] behavior. */
        const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
        if (!sessionSnapshot.exists) {
            throw new https_1.HttpsError("failed-precondition", "No active riddle is awaiting a continue.");
        }
        if (!userSnapshot.exists) {
            throw new https_1.HttpsError("not-found", "User data not found.");
        }
        /** Provides state behavior. */
        const state = sessionSnapshot.data();
        (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
        assertSessionBinding(state, gameMode, riddleId, state.locale, state.contentKey);
        assertCurrentEntitlement(state, userSnapshot.data() ?? {});
        /** Provides coins behavior. */
        const coins = Number(userSnapshot.data()?.coins ?? 0);
        if (state.continueRequestHash === requestHash && state.hasUsedContinue)
            return coins;
        if (state.hasUsedContinue &&
            !state.terminal &&
            !state.awaitingContinue &&
            state.attempts === (0, singlePlayerGuessTransition_1.baseAttemptLimit)(gameMode)) {
            // Semantic retry recovery: a caller that lost the committed response may
            // use a fresh transport request id without being charged again.
            return coins;
        }
        if (state.terminal || !state.awaitingContinue || state.hasUsedContinue) {
            throw new https_1.HttpsError("failed-precondition", "This riddle is not eligible for another attempt.");
        }
        /** Server-selected continuation charge; ad-funded grants use the approved funding path. */
        const cost = funding === "facebook-rewarded" ? 0 : constants_1.CONTINUE_COST_COINS;
        if (coins < cost) {
            throw new https_1.HttpsError("failed-precondition", "Insufficient coins to continue.");
        }
        /** Provides new coins behavior. */
        const newCoins = coins - cost;
        /** Provides continued state behavior. */
        const continuedState = { ...state };
        delete continuedState.lastGuess;
        delete continuedState.lastGuessResult;
        if (cost > 0)
            transaction.update(userRef, { coins: newCoins });
        transaction.set(sessionRef, {
            ...continuedState,
            hasUsedContinue: true,
            awaitingContinue: false,
            continueRequestHash: requestHash,
            continueFunding: funding,
            updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        return newCoins;
    });
}
/** Atomically reveals and charges for one idempotent authoritative hint. */
async function purchaseAuthoritativeHint(userId, request) {
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, request.sessionToken);
    /** Provides r ref. */
    const userRef = firebaseAdmin_1.admin.firestore().collection("users").doc(userId);
    /** Requests hash. */
    const requestHash = opaqueHash(request.requestId);
    /** Provides attempt hash behavior. */
    const attemptHash = opaqueHash(JSON.stringify(request.currentAttempt));
    return firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
        /** Provides [session snapshot, user snapshot] behavior. */
        const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
        if (!sessionSnapshot.exists)
            throw new https_1.HttpsError("permission-denied", "The game session is not valid.");
        if (!userSnapshot.exists)
            throw new https_1.HttpsError("not-found", "User data not found.");
        /** Provides state behavior. */
        const state = sessionSnapshot.data();
        (0, singlePlayerSessionExpiry_1.assertSinglePlayerSessionActive)(state);
        assertSessionBinding(state, request.gameMode, request.riddleId, state.locale, state.contentKey);
        /** Provides prior receipt behavior. */
        const priorReceipt = state.hintReceipts?.[requestHash];
        if (priorReceipt) {
            if (priorReceipt.attemptHash !== attemptHash) {
                throw new https_1.HttpsError("already-exists", "The hint request id was already used for different input.");
            }
            return priorReceipt.result;
        }
        if (state.lastHintAttemptHash === attemptHash && state.lastHintResult)
            return state.lastHintResult;
        if (state.terminal)
            throw new https_1.HttpsError("failed-precondition", "Game is already completed.");
        assertCurrentEntitlement(state, userSnapshot.data() ?? {});
        /** Provides answer letters behavior. */
        const answerLetters = (0, game_3.splitGraphemes)((0, singlePlayerGuessTransition_1.normalizeAnswerText)(state.answer, state.locale), state.locale);
        /** Provides guessed letters behavior. */
        const guessedLetters = request.currentAttempt.map((letter) => (0, singlePlayerGuessTransition_1.normalizeAnswerText)(letter, state.locale));
        /** Provides revealed behavior. */
        const revealed = state.hintRevealedIndices ?? [];
        /** Provides index behavior. */
        const index = answerLetters.findIndex((letter, candidate) => !revealed.includes(candidate) && guessedLetters[candidate] !== letter);
        if (index < 0)
            return null;
        /** Provides r. */
        const user = userSnapshot.data();
        /** Provides coins behavior. */
        const coins = Number(user.coins ?? 0);
        if (coins < constants_1.HINT_COST_COINS) {
            throw new https_1.HttpsError("failed-precondition", "Insufficient coins to get a hint.");
        }
        /** Provides stats behavior. */
        const stats = { ...user.stats, totalHintsUsed: Number(user.stats?.totalHintsUsed ?? 0) + 1 };
        /** Provides new achievements behavior. */
        const newAchievements = (0, achievements_1.findNewAchievements)({ ...user, coins: coins - constants_1.HINT_COST_COINS, stats }, { gameMode: request.gameMode, isCorrect: false, attempts: state.attempts, gameOver: false });
        /** Provides achievement coins behavior. */
        const achievementCoins = (0, game_2.countCoinRewardAchievements)(newAchievements.map((entry) => entry.achievementId)) * constants_1.SOLO_ACHIEVEMENT_COIN_REWARD;
        /** Provides new coins behavior. */
        const newCoins = coins - constants_1.HINT_COST_COINS + achievementCoins;
        /** Provides result behavior. */
        const result = {
            revealedLetter: answerLetters[index].toLocaleUpperCase(state.locale),
            index,
            coinsCost: constants_1.HINT_COST_COINS,
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
                [requestHash]: { attemptHash, result },
            },
            lastHintAttemptHash: attemptHash,
            lastHintResult: result,
            updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        return result;
    });
}
/** Atomically charges, advances, and receipts one authorized Classic skip. */
async function skipAuthoritativeRiddle(userId, request) {
    /** Provides session ref behavior. */
    const sessionRef = getSessionRef(userId, request.sessionToken);
    /** Provides r ref. */
    const userRef = firebaseAdmin_1.admin.firestore().collection("users").doc(userId);
    /** Requests hash. */
    const requestHash = opaqueHash(request.requestId);
    return firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
        /** Provides [session snapshot, user snapshot] behavior. */
        const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
        if (!sessionSnapshot.exists)
            throw new https_1.HttpsError("permission-denied", "The game session is not valid.");
        if (!userSnapshot.exists)
            throw new https_1.HttpsError("not-found", "User data not found.");
        /** Provides state behavior. */
        const state = sessionSnapshot.data();
        assertIssuedSession(state, "classic", request.riddleId);
        /** The same fresh account snapshot supplies replay preparation without changing the immutable receipt. */
        const user = userSnapshot.data();
        if (state.skipResult)
            return { ...state.skipResult, classicSupply: { classicIndex: Number(user.progress?.classicIndex ?? 1), locale: state.locale } };
        if (state.terminal)
            throw new https_1.HttpsError("failed-precondition", "This riddle is already complete.");
        assertCurrentEntitlement(state, user);
        /** Provides coins behavior. */
        const coins = Number(user.coins ?? 0);
        if (coins < constants_1.SKIP_COST_CLASSIC) {
            throw new https_1.HttpsError("failed-precondition", "Insufficient coins to skip this riddle.");
        }
        /** Provides next classic index behavior. */
        const nextClassicIndex = Number(user.progress?.classicIndex ?? 1) + 1;
        /** Provides new progress behavior. */
        const newProgress = {
            classicIndex: nextClassicIndex,
            dailyChallengeIndex: user.progress?.dailyChallengeIndex ?? 0,
            dailyChallengeCurrentQuestion: user.progress?.dailyChallengeCurrentQuestion ?? 0,
        };
        /** Provides result behavior. */
        const result = {
            newCoins: coins - constants_1.SKIP_COST_CLASSIC,
            newProgress,
            costDeducted: constants_1.SKIP_COST_CLASSIC,
        };
        transaction.update(userRef, {
            coins: result.newCoins,
            progress: newProgress,
            "stats.classicSkipped": Number(user.stats?.classicSkipped ?? 0) + 1,
        });
        transaction.set(sessionRef, {
            ...state,
            terminal: true,
            awaitingContinue: false,
            isCorrect: false,
            isSkipped: true,
            skipRequestHash: requestHash,
            skipResult: result,
            updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        return { ...result, classicSupply: { classicIndex: newProgress.classicIndex, locale: state.locale } };
    });
}
//# sourceMappingURL=singlePlayerSession.js.map