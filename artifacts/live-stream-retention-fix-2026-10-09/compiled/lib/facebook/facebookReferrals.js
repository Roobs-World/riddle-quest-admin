"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFacebookReferralBinding = exports.FACEBOOK_REFERRER_DAILY_REWARD_CAP = exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS = exports.FACEBOOK_REFERRAL_REWARD_COINS = void 0;
exports.readFacebookReferralTokenRecord = readFacebookReferralTokenRecord;
exports.issueFacebookReferralToken = issueFacebookReferralToken;
exports.bindFacebookReferralToken = bindFacebookReferralToken;
exports.settleFacebookReferralAfterAuthoritativeWin = settleFacebookReferralAfterAuthoritativeWin;
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const facebookSecurity_1 = require("./facebookSecurity");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
/** Defines the facebook referral reward coins value. */
exports.FACEBOOK_REFERRAL_REWARD_COINS = 100;
/** Defines the facebook referral token ttl ms value. */
exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the facebook referrer daily reward cap value. */
exports.FACEBOOK_REFERRER_DAILY_REWARD_CAP = 5;
/** Defines the facebook referral token bytes value. */
const FACEBOOK_REFERRAL_TOKEN_BYTES = 32;
/** Defines the max date ms value. */
const MAX_DATE_MS = 253_402_300_799_999;
/** Provides hash behavior. */
const hash = (domain, value) => (0, node_crypto_1.createHash)("sha256").update(`riddle-quest\0facebook-referral\0${domain}\0${value}`).digest("hex");
/** Provides token id behavior. */
const tokenId = (token) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
        throw new Error("invalid-facebook-referral-token");
    return hash("token", token);
};
/** Provides require non negative integer behavior. */
const requireNonNegativeInteger = (name, value) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`invalid-facebook-referral-${name}`);
    }
    return value;
};
/** Provides require stat behavior. */
const requireStat = (value, field, missingValue) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("invalid-facebook-referral-stats");
    }
    /** Older profiles may predate multiplayer counters; malformed present values still fail closed. */
    const counter = value[field];
    return requireNonNegativeInteger(`stats-${field}`, counter === undefined ? missingValue : counter);
};
/** Provides safe add behavior. */
const safeAdd = (name, left, right) => {
    /** Provides value behavior. */
    const value = left + right;
    if (!Number.isSafeInteger(value))
        throw new Error(`invalid-facebook-referral-${name}`);
    return value;
};
/** Provides require clock behavior. */
const requireClock = (now) => {
    if (!Number.isSafeInteger(now) || now < 0 || now > MAX_DATE_MS - exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS) {
        throw new Error("invalid-facebook-referral-time");
    }
};
/** Provides require stored clock behavior. */
const requireStoredClock = (name, value) => {
    /** Parses d. */
    const parsed = requireNonNegativeInteger(name, value);
    if (parsed > MAX_DATE_MS)
        throw new Error(`invalid-facebook-referral-${name}`);
    return parsed;
};
/** Provides require binding behavior. */
const requireFacebookReferralBinding = (value, input) => {
    /** Provides inviter uid behavior. */
    const inviterUid = typeof value?.inviterUid === "string" ? value.inviterUid : "";
    /** Provides token behavior. */
    const token = typeof value?.tokenId === "string" ? value.tokenId : "";
    /** Provides bound at ms behavior. */
    const boundAtMs = requireStoredClock("binding-bound-at", value?.boundAtMs);
    /** Sets tled at ms. */
    const settledAtMs = value?.settledAtMs === null ? null : requireStoredClock("binding-settled-at", value?.settledAtMs);
    /** New bindings retain the invitation window after temporary token rows expire. */
    const hasWindow = value?.tokenIssuedAtMs !== undefined || value?.tokenExpiresAtMs !== undefined;
    if (hasWindow) {
        /** Validated server-issued window, never inferred from a client retry clock. */
        const issued = requireStoredClock("binding-token-issued-at", value?.tokenIssuedAtMs);
        /** Seven-day logical expiry remains independent of asynchronous physical deletion. */
        const expires = requireStoredClock("binding-token-expires-at", value?.tokenExpiresAtMs);
        if (expires !== issued + exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS || boundAtMs < issued || boundAtMs >= expires ||
            input.issuedAtMs !== undefined && input.issuedAtMs !== issued || input.expiresAtMs !== undefined && input.expiresAtMs !== expires)
            throw new Error("facebook-referral-binding-conflict");
    }
    if (value?.provider !== "facebook" ||
        value.inviteeUid !== input.inviteeUid ||
        !(0, facebookSecurity_1.isFacebookFirebaseUid)(inviterUid) ||
        inviterUid === input.inviteeUid ||
        !/^[0-9a-f]{64}$/.test(token) ||
        (input.inviterUid !== undefined && inviterUid !== input.inviterUid) ||
        (input.tokenId !== undefined && token !== input.tokenId) ||
        (input.issuedAtMs !== undefined && boundAtMs < input.issuedAtMs) ||
        (input.expiresAtMs !== undefined && boundAtMs >= input.expiresAtMs) ||
        (settledAtMs !== null && settledAtMs < boundAtMs))
        throw new Error("facebook-referral-binding-conflict");
    return { inviterUid, boundAtMs, settledAtMs };
};
exports.requireFacebookReferralBinding = requireFacebookReferralBinding;
/** Validates retained legacy/current invitation rows before binding or retention backfill. */
function readFacebookReferralTokenRecord(value) {
    if (value?.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(value.inviterUid))
        throw new Error("invalid-facebook-referrer");
    /** Both clocks remain inside Firestore's timestamp range. */
    const issuedAtMs = requireStoredClock("token-issued-at", value.issuedAtMs);
    /** Logical expiry is authoritative even if a TTL worker has not deleted the row yet. */
    const expiresAtMs = requireStoredClock("token-expires-at", value.expiresAtMs);
    if (expiresAtMs !== issuedAtMs + exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS)
        throw new Error("invalid-facebook-referral-token-window");
    if (value.expiresAt !== undefined && (!(value.expiresAt instanceof firebaseAdmin_1.admin.firestore.Timestamp) || value.expiresAt.toMillis() !== expiresAtMs))
        throw new Error("invalid-facebook-referral-token-retention");
    return { inviterUid: value.inviterUid, issuedAtMs, expiresAtMs };
}
/** Provides utc day behavior. */
const utcDay = (now) => new Date(now).toISOString().slice(0, 10);
/** Creates an opaque seven-day inviter token; only its hash is persisted. */
async function issueFacebookReferralToken(inviterUid, now = Date.now(), randomToken = () => (0, node_crypto_1.randomBytes)(FACEBOOK_REFERRAL_TOKEN_BYTES).toString("base64url"), db = firebaseAdmin_1.admin.firestore()) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(inviterUid))
        throw new Error("invalid-facebook-referrer");
    requireClock(now);
    /** Provides token behavior. */
    const token = randomToken();
    /** Provides id behavior. */
    const id = tokenId(token);
    /** Provides expires at ms behavior. */
    const expiresAtMs = now + exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS;
    /** Provides token ref behavior. */
    const tokenRef = db.collection("facebookReferralTokens").doc(id);
    /** Provides r ref. */
    const userRef = db.collection("users").doc(inviterUid);
    /** Provides deletion ref behavior. */
    const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid);
    await db.runTransaction(async (transaction) => {
        /** Provides [user, deletion] behavior. */
        const [user, deletion] = await Promise.all([transaction.get(userRef), transaction.get(deletionRef)]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!user.exists)
            throw new Error("facebook-referrer-not-found");
        transaction.create(tokenRef, {
            provider: "facebook",
            inviterUid,
            issuedAtMs: now,
            expiresAtMs,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(expiresAtMs),
        });
    });
    return { token, expiresAtMs };
}
/** Permanently binds one brand-new Facebook player to the token's inviter. */
async function bindFacebookReferralToken(inviteeUid, token, now = Date.now(), db = firebaseAdmin_1.admin.firestore()) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(inviteeUid))
        throw new Error("invalid-facebook-invitee");
    requireClock(now);
    /** Provides id behavior. */
    const id = tokenId(token);
    /** Provides token ref behavior. */
    const tokenRef = db.collection("facebookReferralTokens").doc(id);
    /** Provides binding ref behavior. */
    const bindingRef = db.collection("facebookReferralBindings").doc(inviteeUid);
    /** Provides invitee ref behavior. */
    const inviteeRef = db.collection("users").doc(inviteeUid);
    /** Provides deletion ref behavior. */
    const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviteeUid);
    return db.runTransaction(async (transaction) => {
        /** Provides [token snapshot, binding, invitee, deletion] behavior. */
        const [tokenSnapshot, binding, invitee, deletion] = await Promise.all([
            transaction.get(tokenRef),
            transaction.get(bindingRef),
            transaction.get(inviteeRef),
            transaction.get(deletionRef),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!tokenSnapshot.exists) {
            if (!binding.exists)
                throw new Error("facebook-referral-token-not-found");
            /** A permanent matching receipt makes a completed bind retryable after TTL deletion. */
            (0, exports.requireFacebookReferralBinding)(binding.data(), { inviteeUid, tokenId: id });
            if (binding.data()?.tokenIssuedAtMs === undefined)
                throw new Error("facebook-referral-token-not-found");
            return { alreadyBound: true, expiresAtMs: requireStoredClock("binding-token-expires-at", binding.data()?.tokenExpiresAtMs) };
        }
        /** Provides token data behavior. */
        const tokenData = readFacebookReferralTokenRecord(tokenSnapshot.data());
        /** Provides inviter uid behavior. */
        const inviterUid = tokenData.inviterUid;
        if (inviterUid === inviteeUid) {
            throw new Error("invalid-facebook-referrer");
        }
        /** Provides issued at ms behavior. */
        const issuedAtMs = requireStoredClock("token-issued-at", tokenData.issuedAtMs);
        /** Provides expires at ms behavior. */
        const expiresAtMs = requireStoredClock("token-expires-at", tokenData.expiresAtMs);
        if (expiresAtMs !== issuedAtMs + exports.FACEBOOK_REFERRAL_TOKEN_TTL_MS) {
            throw new Error("invalid-facebook-referral-token-window");
        }
        if (binding.exists) {
            try {
                (0, exports.requireFacebookReferralBinding)(binding.data(), { inviteeUid, inviterUid, tokenId: id, issuedAtMs, expiresAtMs });
            }
            catch {
                throw new Error("facebook-referrer-already-bound");
            }
            return { alreadyBound: true, expiresAtMs };
        }
        if (expiresAtMs <= now || issuedAtMs > now) {
            throw new Error("facebook-referral-token-expired");
        }
        /** Provides [inviter, inviter deletion] behavior. */
        const [inviter, inviterDeletion] = await Promise.all([
            transaction.get(db.collection("users").doc(inviterUid)),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid)),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(inviterDeletion);
        if (!inviter.exists)
            throw new Error("facebook-referrer-not-found");
        if (!invitee.exists)
            throw new Error("facebook-invitee-not-found");
        /** Provides r. */
        const user = invitee.data();
        /** Provides games played behavior. */
        const gamesPlayed = requireStat(user.stats, "gamesPlayed");
        /** Provides wins behavior. */
        const wins = requireStat(user.stats, "wins");
        if (typeof user.hasPurchasedApp !== "boolean")
            throw new Error("invalid-facebook-referral-purchase-state");
        if (gamesPlayed > 0 || wins > 0 || requireStat(user.stats, "multiplayerGamesPlayed", 0) > 0 ||
            requireStat(user.stats, "multiplayerWins", 0) > 0 || requireStat(user.stats, "multiplayerChallengesCreated", 0) > 0 || user.hasPurchasedApp) {
            throw new Error("facebook-invitee-already-established");
        }
        transaction.create(bindingRef, {
            provider: "facebook",
            inviteeUid,
            inviterUid,
            tokenId: id,
            boundAtMs: now,
            settledAtMs: null,
            tokenIssuedAtMs: issuedAtMs,
            tokenExpiresAtMs: expiresAtMs,
        });
        transaction.set(db.doc(`users/${inviteeUid}/knownRivals/${inviterUid}`), {
            targetUserId: inviterUid,
            source: "facebook_invite",
            referralTokenId: id,
            establishedAtMs: now,
        }, { merge: true });
        transaction.set(db.doc(`users/${inviterUid}/knownRivals/${inviteeUid}`), {
            targetUserId: inviteeUid,
            source: "facebook_invite",
            referralTokenId: id,
            establishedAtMs: now,
        }, { merge: true });
        return { alreadyBound: false, expiresAtMs };
    });
}
/** Settles the two-sided reward once, after the invitee has a server-recorded first win. */
async function settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now = Date.now(), db = firebaseAdmin_1.admin.firestore()) {
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("referrals") || !(0, facebookSecurity_1.isFacebookFirebaseUid)(inviteeUid)) {
        return { alreadySettled: false, inviteeCoins: 0, inviterCoins: 0 };
    }
    requireClock(now);
    /** Provides binding ref behavior. */
    const bindingRef = db.collection("facebookReferralBindings").doc(inviteeUid);
    /** Sets tlement ref. */
    const settlementRef = db.collection("facebookReferralSettlements").doc(hash("settlement", inviteeUid));
    /** Provides invitee deletion ref behavior. */
    const inviteeDeletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviteeUid);
    return db.runTransaction(async (transaction) => {
        /** Provides [binding, settlement, invitee deletion] behavior. */
        const [binding, settlement, inviteeDeletion] = await Promise.all([
            transaction.get(bindingRef),
            transaction.get(settlementRef),
            transaction.get(inviteeDeletionRef),
        ]);
        if (settlement.exists) {
            /** Provides data behavior. */
            const data = settlement.data();
            /** Provides replay tombstone behavior. */
            const replayTombstone = data.provider === "facebook" && data.replayProtection === true;
            /** Provides active receipt behavior. */
            const activeReceipt = data.provider === "facebook" &&
                data.replayProtection !== true &&
                data.inviteeUid === inviteeUid &&
                typeof data.inviterUid === "string" &&
                (0, facebookSecurity_1.isFacebookFirebaseUid)(data.inviterUid) &&
                data.inviterUid !== inviteeUid;
            if (!replayTombstone && !activeReceipt)
                throw new Error("facebook-referral-settlement-conflict");
            /** Provides invitee coins behavior. */
            const inviteeCoins = requireNonNegativeInteger("settlement-invitee-coins", data.inviteeCoins);
            /** Provides inviter coins behavior. */
            const inviterCoins = requireNonNegativeInteger("settlement-inviter-coins", data.inviterCoins);
            requireStoredClock("settlement-settled-at", data.settledAtMs);
            if (inviteeCoins !== exports.FACEBOOK_REFERRAL_REWARD_COINS ||
                (inviterCoins !== 0 && inviterCoins !== exports.FACEBOOK_REFERRAL_REWARD_COINS)) {
                throw new Error("facebook-referral-settlement-conflict");
            }
            return {
                alreadySettled: true,
                inviteeCoins,
                inviterCoins,
            };
        }
        (0, jestAccountDeletion_1.assertJestAccountActive)(inviteeDeletion);
        if (!binding.exists)
            return { alreadySettled: false, inviteeCoins: 0, inviterCoins: 0 };
        /** Provides binding data behavior. */
        const bindingData = binding.data();
        /** Parses d binding. */
        const parsedBinding = (0, exports.requireFacebookReferralBinding)(bindingData, { inviteeUid });
        if (parsedBinding.settledAtMs !== null) {
            throw new Error("facebook-referral-settlement-missing");
        }
        /** Provides inviter uid behavior. */
        const inviterUid = parsedBinding.inviterUid;
        /** Provides invitee ref behavior. */
        const inviteeRef = db.collection("users").doc(inviteeUid);
        /** Provides inviter ref behavior. */
        const inviterRef = db.collection("users").doc(inviterUid);
        /** Provides cap ref behavior. */
        const capRef = db.collection("facebookReferralDailyCaps").doc(hash("cap", `${inviterUid}\0${utcDay(now)}`));
        /** Provides inviter deletion ref behavior. */
        const inviterDeletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid);
        /** Provides [invitee, inviter, cap, inviter deletion] behavior. */
        const [invitee, inviter, cap, inviterDeletion] = await Promise.all([
            transaction.get(inviteeRef),
            transaction.get(inviterRef),
            transaction.get(capRef),
            transaction.get(inviterDeletionRef),
        ]);
        if (!invitee.exists || (requireStat(invitee.data()?.stats, "wins") < 1 &&
            requireStat(invitee.data()?.stats, "multiplayerWins", 0) < 1)) {
            throw new Error("facebook-referral-win-not-established");
        }
        /** Provides cap count behavior. */
        const capCount = cap.exists ? requireNonNegativeInteger("daily-cap", cap.data()?.count) : 0;
        if (capCount > exports.FACEBOOK_REFERRER_DAILY_REWARD_CAP)
            throw new Error("facebook-referral-cap-conflict");
        if (cap.exists && (cap.data()?.inviterUid !== inviterUid || cap.data()?.utcDay !== utcDay(now))) {
            throw new Error("facebook-referral-cap-conflict");
        }
        /** Provides inviter eligible behavior. */
        const inviterEligible = inviter.exists && !inviterDeletion.exists && capCount < exports.FACEBOOK_REFERRER_DAILY_REWARD_CAP;
        /** Provides inviter coins behavior. */
        const inviterCoins = inviterEligible ? exports.FACEBOOK_REFERRAL_REWARD_COINS : 0;
        /** Provides invitee balance behavior. */
        const inviteeBalance = requireNonNegativeInteger("invitee-balance", invitee.data()?.coins);
        transaction.update(inviteeRef, {
            coins: safeAdd("invitee-balance", inviteeBalance, exports.FACEBOOK_REFERRAL_REWARD_COINS),
            lastLogin: now,
        });
        if (inviterEligible) {
            /** Provides inviter balance behavior. */
            const inviterBalance = requireNonNegativeInteger("inviter-balance", inviter.data()?.coins);
            transaction.update(inviterRef, {
                coins: safeAdd("inviter-balance", inviterBalance, inviterCoins),
                lastLogin: now,
            });
            transaction.set(capRef, { inviterUid, utcDay: utcDay(now), count: capCount + 1 });
        }
        transaction.update(bindingRef, { settledAtMs: now });
        transaction.create(settlementRef, {
            provider: "facebook",
            inviteeUid,
            inviterUid,
            inviteeCoins: exports.FACEBOOK_REFERRAL_REWARD_COINS,
            inviterCoins,
            settledAtMs: now,
        });
        return { alreadySettled: false, inviteeCoins: exports.FACEBOOK_REFERRAL_REWARD_COINS, inviterCoins };
    });
}
//# sourceMappingURL=facebookReferrals.js.map