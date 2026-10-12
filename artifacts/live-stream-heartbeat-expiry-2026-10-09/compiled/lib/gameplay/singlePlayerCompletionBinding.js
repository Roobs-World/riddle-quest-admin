"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSinglePlayerCompletionBindingRef = void 0;
exports.recordTerminalCompletionBinding = recordTerminalCompletionBinding;
exports.terminalCompletionBindingSettled = terminalCompletionBindingSettled;
exports.getCompletionBoundAuthoritativeSession = getCompletionBoundAuthoritativeSession;
exports.completionBindingMatches = completionBindingMatches;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const singlePlayerSessionExpiry_1 = require("./singlePlayerSessionExpiry");
/** Produces a fixed Firestore identifier without exposing canonical entitlement data. */
const opaqueHash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
/** Resolves a private session document owned by one player. */
const getSessionRef = (userId, sessionToken) => firebaseAdmin_1.admin.firestore().collection("users").doc(userId).collection("singlePlayerSessions").doc(opaqueHash(sessionToken));
/** Resolves the locale-independent pending terminal pointer for one entitlement. */
const getSinglePlayerCompletionBindingRef = (userId, gameMode, completionKey) => firebaseAdmin_1.admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("singlePlayerCompletionBindings")
    .doc(opaqueHash(`${gameMode}\0${completionKey}`));
exports.getSinglePlayerCompletionBindingRef = getSinglePlayerCompletionBindingRef;
/** Returns a validated pending pointer or fails closed on corrupted private state. */
const parseCompletionBinding = (value) => {
    /** Provides data behavior. */
    const data = value;
    if (!data ||
        typeof data.sessionToken !== "string" ||
        data.sessionToken.length < 20 ||
        data.sessionToken.length > 128 ||
        (data.gameMode !== "classic" && data.gameMode !== "challenge") ||
        typeof data.completionKey !== "string" ||
        !data.completionKey ||
        typeof data.riddleId !== "string" ||
        !data.riddleId ||
        data.terminal !== true ||
        typeof data.isCorrect !== "boolean") {
        throw new https_1.HttpsError("internal", "The pending game completion binding is invalid.");
    }
    return data;
};
/**
 * Records a terminal pointer in the same transaction as the session state.
 * A proven win cannot be masked by a later loss or a newly issued active locale.
 */
async function recordTerminalCompletionBinding(transaction, userId, sessionToken, state) {
    if (!state.terminal)
        throw new https_1.HttpsError("internal", "Only terminal sessions can be bound for recovery.");
    /** Provides binding ref behavior. */
    const bindingRef = (0, exports.getSinglePlayerCompletionBindingRef)(userId, state.gameMode, state.completionKey);
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(bindingRef);
    if (snapshot.exists) {
        /** Provides existing behavior. */
        const existing = parseCompletionBinding(snapshot.data());
        if (existing.gameMode !== state.gameMode || existing.completionKey !== state.completionKey) {
            throw new https_1.HttpsError("internal", "The pending game completion binding does not match its entitlement.");
        }
        if (existing.sessionToken !== sessionToken && (existing.isCorrect || !state.isCorrect))
            return;
    }
    transaction.set(bindingRef, {
        sessionToken,
        gameMode: state.gameMode,
        completionKey: state.completionKey,
        riddleId: state.riddleId,
        terminal: true,
        isCorrect: state.isCorrect,
        terminalAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: (0, singlePlayerSessionExpiry_1.sessionExpiry)(),
    });
}
/**
 * Reports whether {@link recordTerminalCompletionBinding} would leave the pointer as it already is.
 *
 * Lets a read-only caller skip a locking transaction when the terminal guess
 * already bound this session. Any mismatch or corruption returns false so the
 * read-write path keeps sole ownership of repairs and failures.
 */
async function terminalCompletionBindingSettled(transaction, userId, sessionToken, state) {
    if (!state.terminal)
        return false;
    /** Pointer the read-write path would otherwise rewrite. */
    const snapshot = await transaction.get((0, exports.getSinglePlayerCompletionBindingRef)(userId, state.gameMode, state.completionKey));
    if (!snapshot.exists)
        return false;
    /** Stored pointer, or undefined when the read-write path must fail closed. */
    let existing;
    try {
        existing = parseCompletionBinding(snapshot.data());
    }
    catch {
        return false;
    }
    if (existing.gameMode !== state.gameMode || existing.completionKey !== state.completionKey)
        return false;
    if (existing.sessionToken !== sessionToken)
        return existing.isCorrect || !state.isCorrect;
    return existing.riddleId === state.riddleId && existing.isCorrect === state.isCorrect;
}
/** Loads a locale-independent terminal session without querying answer-bearing documents. */
async function getCompletionBoundAuthoritativeSession(userId, gameMode, completionKey) {
    /** Provides binding snapshot behavior. */
    const bindingSnapshot = await (0, exports.getSinglePlayerCompletionBindingRef)(userId, gameMode, completionKey).get();
    if (!bindingSnapshot.exists)
        return undefined;
    /** Provides binding behavior. */
    const binding = parseCompletionBinding(bindingSnapshot.data());
    if (binding.gameMode !== gameMode || binding.completionKey !== completionKey) {
        throw new https_1.HttpsError("permission-denied", "The pending game completion does not match this entitlement.");
    }
    /** Provides session snapshot behavior. */
    const sessionSnapshot = await getSessionRef(userId, binding.sessionToken).get();
    if (!sessionSnapshot.exists)
        return undefined;
    /** Provides state behavior. */
    const state = sessionSnapshot.data();
    if ((0, singlePlayerSessionExpiry_1.isSinglePlayerSessionExpired)(state))
        return undefined;
    if (state.gameMode !== binding.gameMode ||
        state.completionKey !== binding.completionKey ||
        state.riddleId !== binding.riddleId ||
        !state.terminal ||
        state.isCorrect !== binding.isCorrect) {
        throw new https_1.HttpsError("permission-denied", "The pending game completion session is invalid.");
    }
    return { sessionToken: binding.sessionToken, state };
}
/** Checks whether a pointer belongs to the exact completion being committed. */
function completionBindingMatches(value, expected) {
    try {
        /** Provides binding behavior. */
        const binding = parseCompletionBinding(value);
        return (binding.sessionToken === expected.sessionToken &&
            binding.gameMode === expected.gameMode &&
            binding.completionKey === expected.completionKey &&
            binding.riddleId === expected.riddleId);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=singlePlayerCompletionBinding.js.map