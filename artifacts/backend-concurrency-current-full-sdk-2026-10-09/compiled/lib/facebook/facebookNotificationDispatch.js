"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFacebookNotificationDispatchLedger = createFacebookNotificationDispatchLedger;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const facebookSecurity_1 = require("./facebookSecurity");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
/** Original attempts may be admitted for five minutes; callers must never refresh their issuance. */
const ADMISSION_MS = 300_000;
/** Receipts outlive the provider's maximum 30-day scheduled delay; slots themselves do not expire. */
const RECEIPT_RETENTION_MS = 31 * 86_400_000;
/** Document ID hashes contain no raw Meta ID, notification copy or token. */
const hash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
/** Server-owned cancellation groups match the transport's local label policy. */
const Label = zod_1.z.string().regex(/^riddlequest_[a-z0-9_-]{1,52}$/u);
/** Scope and content digests are purpose-bound before storage. */
const Hash = zod_1.z.string().regex(/^[0-9a-f]{64}$/u);
/** One pending or uncertain send consumes one slot until confirmed cleanup. */
const Slot = zod_1.z.object({
    label: Label, sendHash: Hash, scheduled: zod_1.z.boolean(),
    phase: zod_1.z.enum(["sending", "confirmed", "uncertain"]), cancelHash: Hash.optional(),
}).strict();
/** A bounded private document serializes the five-slot limit and opt-out. */
const State = zod_1.z.object({ schemaVersion: zod_1.z.literal(1), scopeHash: Hash, suspended: zod_1.z.boolean(), slots: zod_1.z.array(Slot).max(5) })
    .strict().refine(value => new Set(value.slots.map(slot => slot.label)).size === value.slots.length);
/** Enforces one stable work item shape before transactional admission. */
const Request = zod_1.z.object({
    attemptId: zod_1.z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
    issuedAtMs: zod_1.z.number().int().safe().nonnegative().max(253_402_300_799_999 - RECEIPT_RETENTION_MS),
    operation: zod_1.z.enum(["send", "cancel"]), label: Label, requestDigest: Hash,
    scheduleInterval: zod_1.z.number().int().min(300).max(2_592_000).optional(),
}).strict().refine(value => value.operation !== "cancel" || value.scheduleInterval === undefined);
/** A receipt preserves replay and exactly one terminal result for the entire original scope. */
const Receipt = zod_1.z.object({
    schemaVersion: zod_1.z.literal(1), scopeHash: Hash, requestHash: Hash, issuedAtMs: zod_1.z.number().int().safe().nonnegative(),
    expiresAt: zod_1.z.instanceof(firestore_1.Timestamp), outcome: zod_1.z.enum(["pending", "confirmed", "unconfirmed", "not-sent"]),
}).strict();
/** Creates the one-time consent, identity and capacity ledger used by server-composed notification work. */
function createFacebookNotificationDispatchLedger(db, identity, options) {
    /** Snapshot configured provider/actor scope before any asynchronous database work. */
    const actor = Object.freeze({ ...identity });
    /** Configured app is immutable for this dispatcher. */
    const appId = options.appId;
    if (typeof appId !== "string" || !/^[0-9]{5,30}$/u.test(appId) || actor.accountGeneration > facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION ||
        (0, facebookSecurity_1.facebookFirebaseUid)(actor.playerId, options.uidSecret, actor.accountGeneration) !== actor.uid) {
        throw new Error("facebook-notification-identity-invalid");
    }
    /** Raw Meta identity is retained only by the existing canonical provider link. */
    const providerRef = db.collection("providerIdentities").doc(hash(`${appId}\0${actor.playerId}`));
    /** Deletion guards are shared account infrastructure, not a Jest notification API. */
    const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, actor.uid);
    /** Existing recursive account deletion removes these private subcollections. */
    const userRef = db.collection("users").doc(actor.uid);
    /** Five-slot state is private and never expires based only on time. */
    const stateRef = userRef.collection("facebookNotificationState").doc("current");
    /** Scope prevents a receipt or state row from being transplanted across apps/generations. */
    const scopeHash = hash(`facebook-notification-scope-v1\0${appId}\0${actor.uid}\0${actor.accountGeneration}`);
    /** Clock is resolved afresh after transaction reads and retries. */
    const now = options.now ?? Date.now;
    /** Parses bounded state without repairing corruption or resetting uncertain slots. */
    const parseState = (value) => {
        /** Absence means this generation has never reserved a notification. */
        const state = value === undefined ? { schemaVersion: 1, scopeHash, suspended: false, slots: [] } : State.parse(value);
        if (state.scopeHash !== scopeHash)
            throw new Error("facebook-notification-state-conflict");
        return state;
    };
    /** Binds receipt identity to the original work ID and full content/scheduling fingerprint. */
    const prepare = (input) => {
        /** Exact request parsing prevents changed/extra fields from changing retry scope. */
        const request = Request.parse(input);
        /** Purpose-scoped opaque document ID, independent of localized copy. */
        const attemptHash = hash(`facebook-notification-attempt-v1\0${scopeHash}\0${request.attemptId}`);
        /** Content and issuance are both immutable across an operation retry. */
        const requestHash = hash(JSON.stringify({ ...request, scopeHash }));
        return { request, attemptHash, requestHash, receiptRef: userRef.collection("facebookNotificationAttempts").doc(attemptHash) };
    };
    /** Validates stored expiry without extending a receipt or accepting a scope transplant. */
    const parseReceipt = (value, requestHash, issuedAtMs) => {
        /** Actual Admin SDK timestamps are required, not a browser JSON timestamp. */
        const receipt = Receipt.parse(value);
        if (receipt.scopeHash !== scopeHash || receipt.requestHash !== requestHash || receipt.issuedAtMs !== issuedAtMs ||
            !receipt.expiresAt.isEqual(firestore_1.Timestamp.fromMillis(receipt.issuedAtMs + RECEIPT_RETENTION_MS))) {
            throw new Error("facebook-notification-receipt-conflict");
        }
        return receipt;
    };
    return {
        /** Atomically reserves capacity and one-use authorization before transport can transmit. */
        claim: async (input) => {
            /** Immutable parsed work is reused on every transaction retry. */
            const prepared = prepare(input);
            /** A commit may itself be delayed; check original freshness again before releasing authorization. */
            const granted = await db.runTransaction(async (tx) => {
                /** All authority and capacity reads precede writes in the same transaction. */
                const [user, provider, deletion, consent, snapshot, prior] = await Promise.all([
                    tx.get(userRef), tx.get(providerRef), tx.get(deletionRef),
                    tx.get(db.collection("facebookNotificationPromptLeases").doc(actor.uid)),
                    tx.get(stateRef), tx.get(prepared.receiptRef),
                ]);
                /** Prior issuance cannot be revived by updating a retry timestamp or waiting for TTL. */
                const clock = now();
                if (!Number.isSafeInteger(clock) || clock < prepared.request.issuedAtMs || clock - prepared.request.issuedAtMs >= ADMISSION_MS)
                    return false;
                /** Validate even a duplicate receipt before treating it as safely spent. */
                if (prior.exists) {
                    parseReceipt(prior.data(), prepared.requestHash, prepared.request.issuedAtMs);
                    return false;
                }
                /** Live provider scope is required; cleanup may run during deletion before the sweep. */
                const link = provider.data();
                if (!provider.exists || link?.provider !== "facebook" || link.appId !== appId || link.providerPlayerId !== actor.playerId ||
                    link.uid !== actor.uid || link.accountGeneration !== actor.accountGeneration ||
                    (link.status !== "active" && !(prepared.request.operation === "cancel" && link.status === "deleting")))
                    return false;
                /** Corrupt state cannot free a pending provider slot. */
                const state = parseState(snapshot.exists ? snapshot.data() : undefined);
                /** Each app-owned label has at most one pending/uncertain send and cancellation. */
                const index = state.slots.findIndex(slot => slot.label === prepared.request.label);
                if (prepared.request.operation === "send") {
                    /** Consent is server-recorded; current platform opt-in still needs hosted proof before wiring. */
                    const permission = consent.data();
                    /** Consent chronology must match whole-millisecond timestamps written by the prompt authority. */
                    const acceptedAtMs = permission?.acceptedAt instanceof firestore_1.Timestamp ? permission.acceptedAt.toMillis() : Number.NaN;
                    /** Corrupt negative/fractional issuance cannot stand in for a granted prompt. */
                    const promptedAtMs = permission?.lastPromptAt instanceof firestore_1.Timestamp ? permission.lastPromptAt.toMillis() : Number.NaN;
                    if (!user.exists || deletion.exists || state.suspended || !(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("notifications") ||
                        permission?.schemaVersion !== 1 || permission.uid !== actor.uid || permission.accepted !== true ||
                        !Number.isSafeInteger(acceptedAtMs) || !Number.isSafeInteger(promptedAtMs) || promptedAtMs < 0 ||
                        acceptedAtMs > clock || acceptedAtMs < promptedAtMs ||
                        state.slots.length >= 5 || index >= 0)
                        return false;
                    state.slots.push({ label: prepared.request.label, sendHash: prepared.attemptHash,
                        scheduled: prepared.request.scheduleInterval !== undefined, phase: "sending" });
                }
                else {
                    // Never race a still-running or uncertain send with cancel: a late send could land after cancel acknowledgement.
                    if (index < 0 || state.slots[index].phase !== "confirmed" || state.slots[index].cancelHash !== undefined)
                        return false;
                    state.slots[index].cancelHash = prepared.attemptHash;
                }
                tx.set(stateRef, State.parse(state));
                tx.create(prepared.receiptRef, { schemaVersion: 1, scopeHash, requestHash: prepared.requestHash,
                    issuedAtMs: prepared.request.issuedAtMs, expiresAt: firestore_1.Timestamp.fromMillis(prepared.request.issuedAtMs + RECEIPT_RETENTION_MS), outcome: "pending" });
                return true;
            });
            /** An expired commit remains conservatively reserved and cannot cause a late transport send. */
            const clock = now();
            return granted && Number.isSafeInteger(clock) && clock >= prepared.request.issuedAtMs && clock - prepared.request.issuedAtMs < ADMISSION_MS;
        },
        /** Persists the transport's exact terminal result once; uncertainty cannot be converted into an automatic retry. */
        finish: async (input, result) => {
            if (!["confirmed", "unconfirmed", "not-sent"].includes(result.outcome) ||
                (result.outcome === "confirmed" && (!Number.isInteger(result.httpStatus) || result.httpStatus < 200 || result.httpStatus > 299))) {
                throw new Error("facebook-notification-result-invalid");
            }
            /** Original immutable request binds settlement to its one authorized transport attempt. */
            const prepared = prepare(input);
            await db.runTransaction(async (tx) => {
                /** Missing rows after account deletion cannot be recreated by a late transport result. */
                const [snapshot, stored] = await Promise.all([tx.get(stateRef), tx.get(prepared.receiptRef)]);
                if (!snapshot.exists || !stored.exists)
                    throw new Error("facebook-notification-attempt-missing");
                /** Exact scope/expiry and stored outcome are validated before an idempotent return. */
                const receipt = parseReceipt(stored.data(), prepared.requestHash, prepared.request.issuedAtMs);
                if (receipt.outcome !== "pending") {
                    if (receipt.outcome !== result.outcome)
                        throw new Error("facebook-notification-result-conflict");
                    return;
                }
                /** Pending state must name the same sender or canceller, not a newer replacement. */
                const state = parseState(snapshot.data());
                /** Slot identity binds the result to the label originally reserved. */
                const index = state.slots.findIndex(slot => slot.label === prepared.request.label);
                if (index < 0 || (prepared.request.operation === "send" ? state.slots[index].sendHash : state.slots[index].cancelHash) !== prepared.attemptHash) {
                    throw new Error("facebook-notification-slot-conflict");
                }
                if (prepared.request.operation === "send") {
                    if (result.outcome === "not-sent" || (result.outcome === "confirmed" && !state.slots[index].scheduled))
                        state.slots.splice(index, 1);
                    else
                        state.slots[index].phase = result.outcome === "confirmed" ? "confirmed" : "uncertain";
                }
                else if (result.outcome === "confirmed")
                    state.slots.splice(index, 1);
                else if (result.outcome === "not-sent")
                    delete state.slots[index].cancelHash;
                // Unconfirmed cancellation retains its exact lock and slot; neither elapsed time nor a new ID frees it.
                tx.set(stateRef, State.parse(state));
                tx.update(prepared.receiptRef, { outcome: result.outcome });
            });
        },
        /** Revokes sending atomically with the same capacity document; existing slots remain for confirmed cleanup. */
        suspend: async () => {
            await db.runTransaction(async (tx) => {
                /** Do not create an orphan state after the account's recursive deletion has completed. */
                const [user, snapshot] = await Promise.all([tx.get(userRef), tx.get(stateRef)]);
                if (!user.exists && !snapshot.exists)
                    return;
                /** Revocation never resets capacity or discards a provider attempt. */
                const state = parseState(snapshot.exists ? snapshot.data() : undefined);
                tx.set(stateRef, { ...state, suspended: true });
            });
        },
    };
}
//# sourceMappingURL=facebookNotificationDispatch.js.map