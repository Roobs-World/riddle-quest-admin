"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDDIT_REFERRER_DAILY_REWARD_CAP = exports.REDDIT_REFERRAL_TOKEN_TTL_MS = exports.REDDIT_REFERRAL_REWARD_COINS = void 0;
exports.issueRedditReferralToken = issueRedditReferralToken;
exports.bindRedditReferralToken = bindRedditReferralToken;
exports.settleRedditReferralAfterAuthoritativeWin = settleRedditReferralAfterAuthoritativeWin;
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const redditSecurity_1 = require("./redditSecurity");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
const validation_1 = require("@qwordly/core/validation");
/** Defines the reddit referral reward coins value. */
exports.REDDIT_REFERRAL_REWARD_COINS = 100;
/** Defines the reddit referral token ttl ms value. */
exports.REDDIT_REFERRAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the reddit referrer daily reward cap value. */
exports.REDDIT_REFERRER_DAILY_REWARD_CAP = 5;
/** Defines the reddit referral token bytes value. */
const REDDIT_REFERRAL_TOKEN_BYTES = 32;
/** Defines the max date ms value. */
const MAX_DATE_MS = 8_640_000_000_000_000;
/** Provides hash behavior. */
const hash = (domain, value) => (0, node_crypto_1.createHash)("sha256").update(`riddle-quest\0reddit-referral\0${domain}\0${value}`).digest("hex");
/** Provides require provenance behavior. */
const requireProvenance = (value) => {
    if (!validation_1.SUPPORTED_LOCALES.includes(value.locale) ||
        !/^t3_[A-Za-z0-9_-]{1,100}$/.test(value.postId) ||
        (value.environment !== "sandbox" && value.environment !== "production")) {
        throw new Error("invalid-reddit-referral-provenance");
    }
    return { locale: value.locale, postIdHash: hash("post", value.postId), environment: value.environment };
};
/** Provides token id behavior. */
const tokenId = (token) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
        throw new Error("invalid-reddit-referral-token");
    return hash("token", token);
};
/** Provides require non negative integer behavior. */
const requireNonNegativeInteger = (name, value) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`invalid-reddit-referral-${name}`);
    }
    return value;
};
/** Provides require stat behavior. */
const requireStat = (value, field, missingValue) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("invalid-reddit-referral-stats");
    }
    /** Older profiles may omit multiplayer counters; malformed present values remain invalid. */
    const counter = value[field];
    return requireNonNegativeInteger(`stats-${field}`, counter === undefined ? missingValue : counter);
};
/** Provides safe add behavior. */
const safeAdd = (name, left, right) => {
    /** Provides value behavior. */
    const value = left + right;
    if (!Number.isSafeInteger(value))
        throw new Error(`invalid-reddit-referral-${name}`);
    return value;
};
/** Provides require clock behavior. */
const requireClock = (now) => {
    if (!Number.isSafeInteger(now) || now < 0 || now > MAX_DATE_MS - exports.REDDIT_REFERRAL_TOKEN_TTL_MS) {
        throw new Error("invalid-reddit-referral-time");
    }
};
/** Provides require stored clock behavior. */
const requireStoredClock = (name, value) => {
    /** Parses d. */
    const parsed = requireNonNegativeInteger(name, value);
    if (parsed > MAX_DATE_MS)
        throw new Error(`invalid-reddit-referral-${name}`);
    return parsed;
};
/** Provides require binding behavior. */
const requireBinding = (value, input) => {
    /** Provides inviter uid behavior. */
    const inviterUid = typeof value?.inviterUid === "string" ? value.inviterUid : "";
    /** Provides token behavior. */
    const token = typeof value?.tokenId === "string" ? value.tokenId : "";
    /** Provides bound at ms behavior. */
    const boundAtMs = requireStoredClock("binding-bound-at", value?.boundAtMs);
    /** Sets tled at ms. */
    const settledAtMs = value?.settledAtMs === null ? null : requireStoredClock("binding-settled-at", value?.settledAtMs);
    if (value?.provider !== "reddit" ||
        value.inviteeUid !== input.inviteeUid ||
        !(0, redditSecurity_1.isRedditFirebaseUid)(inviterUid) ||
        inviterUid === input.inviteeUid ||
        !/^[0-9a-f]{64}$/.test(token) ||
        (input.inviterUid !== undefined && inviterUid !== input.inviterUid) ||
        (input.tokenId !== undefined && token !== input.tokenId) ||
        (input.issuedAtMs !== undefined && boundAtMs < input.issuedAtMs) ||
        (input.expiresAtMs !== undefined && boundAtMs >= input.expiresAtMs) ||
        (input.locale !== undefined && value.locale !== input.locale) ||
        (input.postIdHash !== undefined && value.postIdHash !== input.postIdHash) ||
        (input.environment !== undefined && value.environment !== input.environment) ||
        (settledAtMs !== null && settledAtMs < boundAtMs))
        throw new Error("reddit-referral-binding-conflict");
    return { inviterUid, boundAtMs, settledAtMs };
};
/** Provides utc day behavior. */
const utcDay = (now) => new Date(now).toISOString().slice(0, 10);
/** Creates an opaque seven-day inviter token; only its hash is persisted. */
async function issueRedditReferralToken(inviterUid, now = Date.now(), randomToken = () => (0, node_crypto_1.randomBytes)(REDDIT_REFERRAL_TOKEN_BYTES).toString("base64url"), db = firebaseAdmin_1.admin.firestore(), provenance) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(inviterUid))
        throw new Error("invalid-reddit-referrer");
    requireClock(now);
    /** Provides token behavior. */
    const token = randomToken();
    /** Provides id behavior. */
    const id = tokenId(token);
    /** Provides expires at ms behavior. */
    const expiresAtMs = now + exports.REDDIT_REFERRAL_TOKEN_TTL_MS;
    /** Provides token ref behavior. */
    const tokenRef = db.collection("redditReferralTokens").doc(id);
    /** Provides trusted behavior. */
    const trusted = provenance ? requireProvenance(provenance) : undefined;
    /** Provides r ref. */
    const userRef = db.collection("users").doc(inviterUid);
    /** Provides deletion ref behavior. */
    const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid);
    await db.runTransaction(async (transaction) => {
        /** Provides [user, deletion] behavior. */
        const [user, deletion] = await Promise.all([transaction.get(userRef), transaction.get(deletionRef)]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!user.exists)
            throw new Error("reddit-referrer-not-found");
        transaction.create(tokenRef, {
            provider: "reddit",
            inviterUid,
            issuedAtMs: now,
            expiresAtMs,
            ...(trusted ?? {}),
        });
    });
    return { token, expiresAtMs };
}
/** Permanently binds one brand-new Reddit player to the token's inviter. */
async function bindRedditReferralToken(inviteeUid, token, now = Date.now(), db = firebaseAdmin_1.admin.firestore(), provenance) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(inviteeUid))
        throw new Error("invalid-reddit-invitee");
    requireClock(now);
    /** Provides id behavior. */
    const id = tokenId(token);
    /** Provides token ref behavior. */
    const tokenRef = db.collection("redditReferralTokens").doc(id);
    /** Provides binding ref behavior. */
    const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
    /** Provides invitee ref behavior. */
    const inviteeRef = db.collection("users").doc(inviteeUid);
    /** Provides deletion ref behavior. */
    const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviteeUid);
    /** Provides trusted behavior. */
    const trusted = provenance ? requireProvenance(provenance) : undefined;
    return db.runTransaction(async (transaction) => {
        /** Provides [token snapshot, binding, invitee, deletion] behavior. */
        const [tokenSnapshot, binding, invitee, deletion] = await Promise.all([
            transaction.get(tokenRef),
            transaction.get(bindingRef),
            transaction.get(inviteeRef),
            transaction.get(deletionRef),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!tokenSnapshot.exists)
            throw new Error("reddit-referral-token-not-found");
        /** Provides token data behavior. */
        const tokenData = tokenSnapshot.data();
        /** Provides inviter uid behavior. */
        const inviterUid = typeof tokenData.inviterUid === "string" ? tokenData.inviterUid : "";
        if (tokenData.provider !== "reddit" || !(0, redditSecurity_1.isRedditFirebaseUid)(inviterUid) || inviterUid === inviteeUid) {
            throw new Error("invalid-reddit-referrer");
        }
        /** Provides issued at ms behavior. */
        const issuedAtMs = requireStoredClock("token-issued-at", tokenData.issuedAtMs);
        /** Provides expires at ms behavior. */
        const expiresAtMs = requireStoredClock("token-expires-at", tokenData.expiresAtMs);
        if (trusted &&
            (tokenData.locale !== trusted.locale ||
                tokenData.postIdHash !== trusted.postIdHash ||
                tokenData.environment !== trusted.environment)) {
            throw new Error("reddit-referral-provenance-mismatch");
        }
        if (expiresAtMs !== issuedAtMs + exports.REDDIT_REFERRAL_TOKEN_TTL_MS) {
            throw new Error("invalid-reddit-referral-token-window");
        }
        if (binding.exists) {
            try {
                requireBinding(binding.data(), { inviteeUid, inviterUid, tokenId: id, issuedAtMs, expiresAtMs, ...trusted });
            }
            catch {
                throw new Error("reddit-referrer-already-bound");
            }
            return { alreadyBound: true, expiresAtMs };
        }
        if (expiresAtMs <= now || issuedAtMs > now) {
            throw new Error("reddit-referral-token-expired");
        }
        /** Provides [inviter, inviter deletion] behavior. */
        const [inviter, inviterDeletion] = await Promise.all([
            transaction.get(db.collection("users").doc(inviterUid)),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid)),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(inviterDeletion);
        if (!inviter.exists)
            throw new Error("reddit-referrer-not-found");
        if (!invitee.exists)
            throw new Error("reddit-invitee-not-found");
        /** Provides r. */
        const user = invitee.data();
        /** Provides games played behavior. */
        const gamesPlayed = requireStat(user.stats, "gamesPlayed");
        /** Server-recorded solo wins can establish the referral conversion milestone. */
        const wins = requireStat(user.stats, "wins");
        if (typeof user.hasPurchasedApp !== "boolean")
            throw new Error("invalid-reddit-referral-purchase-state");
        if (gamesPlayed > 0 || wins > 0 || requireStat(user.stats, "multiplayerWins", 0) > 0 ||
            requireStat(user.stats, "multiplayerGamesPlayed", 0) > 0 || requireStat(user.stats, "multiplayerChallengesCreated", 0) > 0 || user.hasPurchasedApp) {
            throw new Error("reddit-invitee-already-established");
        }
        transaction.create(bindingRef, {
            provider: "reddit",
            inviteeUid,
            inviterUid,
            tokenId: id,
            boundAtMs: now,
            settledAtMs: null,
            ...(trusted ?? {}),
        });
        transaction.set(db.doc(`users/${inviteeUid}/knownRivals/${inviterUid}`), {
            targetUserId: inviterUid,
            source: "reddit_invite",
            referralTokenId: id,
            establishedAtMs: now,
        }, { merge: true });
        transaction.set(db.doc(`users/${inviterUid}/knownRivals/${inviteeUid}`), {
            targetUserId: inviteeUid,
            source: "reddit_invite",
            referralTokenId: id,
            establishedAtMs: now,
        }, { merge: true });
        return { alreadyBound: false, expiresAtMs };
    });
}
/** Settles the two-sided reward once, after the invitee has a server-recorded first win. */
async function settleRedditReferralAfterAuthoritativeWin(inviteeUid, now = Date.now(), db = firebaseAdmin_1.admin.firestore()) {
    if (!(0, redditFeatureFlags_1.isRedditFeatureEnabled)("referrals") || !(0, redditSecurity_1.isRedditFirebaseUid)(inviteeUid)) {
        return { alreadySettled: false, inviteeCoins: 0, inviterCoins: 0 };
    }
    requireClock(now);
    /** Provides binding ref behavior. */
    const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
    /** Sets tlement ref. */
    const settlementRef = db.collection("redditReferralSettlements").doc(hash("settlement", inviteeUid));
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
            const replayTombstone = data.provider === "reddit" && data.replayProtection === true;
            /** Provides active receipt behavior. */
            const activeReceipt = data.provider === "reddit" &&
                data.replayProtection !== true &&
                data.inviteeUid === inviteeUid &&
                typeof data.inviterUid === "string" &&
                (0, redditSecurity_1.isRedditFirebaseUid)(data.inviterUid) &&
                data.inviterUid !== inviteeUid;
            if (!replayTombstone && !activeReceipt)
                throw new Error("reddit-referral-settlement-conflict");
            /** Provides invitee coins behavior. */
            const inviteeCoins = requireNonNegativeInteger("settlement-invitee-coins", data.inviteeCoins);
            /** Provides inviter coins behavior. */
            const inviterCoins = requireNonNegativeInteger("settlement-inviter-coins", data.inviterCoins);
            requireStoredClock("settlement-settled-at", data.settledAtMs);
            if (inviteeCoins !== exports.REDDIT_REFERRAL_REWARD_COINS ||
                (inviterCoins !== 0 && inviterCoins !== exports.REDDIT_REFERRAL_REWARD_COINS)) {
                throw new Error("reddit-referral-settlement-conflict");
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
        const parsedBinding = requireBinding(bindingData, { inviteeUid });
        if (parsedBinding.settledAtMs !== null) {
            throw new Error("reddit-referral-settlement-missing");
        }
        /** Provides inviter uid behavior. */
        const inviterUid = parsedBinding.inviterUid;
        /** Provides invitee ref behavior. */
        const inviteeRef = db.collection("users").doc(inviteeUid);
        /** Provides inviter ref behavior. */
        const inviterRef = db.collection("users").doc(inviterUid);
        /** Provides cap ref behavior. */
        const capRef = db.collection("redditReferralDailyCaps").doc(hash("cap", `${inviterUid}\0${utcDay(now)}`));
        /** Provides inviter deletion ref behavior. */
        const inviterDeletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, inviterUid);
        /** Provides [invitee, inviter, cap, inviter deletion] behavior. */
        const [invitee, inviter, cap, inviterDeletion] = await Promise.all([
            transaction.get(inviteeRef),
            transaction.get(inviterRef),
            transaction.get(capRef),
            transaction.get(inviterDeletionRef),
        ]);
        if (!invitee.exists)
            throw new Error("reddit-referral-win-not-established");
        /** Server-recorded solo wins can establish the referral conversion milestone. */
        const wins = requireStat(invitee.data()?.stats, "wins");
        /** A confirmed multiplayer win also qualifies the invitee for conversion. */
        const multiplayerWins = requireStat(invitee.data()?.stats, "multiplayerWins", 0);
        if (wins < 1 && multiplayerWins < 1) {
            throw new Error("reddit-referral-win-not-established");
        }
        /** Provides cap count behavior. */
        const capCount = cap.exists ? requireNonNegativeInteger("daily-cap", cap.data()?.count) : 0;
        if (capCount > exports.REDDIT_REFERRER_DAILY_REWARD_CAP)
            throw new Error("reddit-referral-cap-conflict");
        if (cap.exists && (cap.data()?.inviterUid !== inviterUid || cap.data()?.utcDay !== utcDay(now))) {
            throw new Error("reddit-referral-cap-conflict");
        }
        /** Provides inviter eligible behavior. */
        const inviterEligible = inviter.exists && !inviterDeletion.exists && capCount < exports.REDDIT_REFERRER_DAILY_REWARD_CAP;
        /** Provides inviter coins behavior. */
        const inviterCoins = inviterEligible ? exports.REDDIT_REFERRAL_REWARD_COINS : 0;
        /** Provides invitee balance behavior. */
        const inviteeBalance = requireNonNegativeInteger("invitee-balance", invitee.data()?.coins);
        transaction.update(inviteeRef, {
            coins: safeAdd("invitee-balance", inviteeBalance, exports.REDDIT_REFERRAL_REWARD_COINS),
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
            provider: "reddit",
            inviteeUid,
            inviterUid,
            inviteeCoins: exports.REDDIT_REFERRAL_REWARD_COINS,
            inviterCoins,
            settledAtMs: now,
        });
        return { alreadySettled: false, inviteeCoins: exports.REDDIT_REFERRAL_REWARD_COINS, inviterCoins };
    });
}
//# sourceMappingURL=redditReferrals.js.map