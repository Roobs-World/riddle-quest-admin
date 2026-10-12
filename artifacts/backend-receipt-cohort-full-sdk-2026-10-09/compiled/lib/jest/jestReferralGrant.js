"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantJestReferralRewards = grantJestReferralRewards;
const referrals_1 = require("@qwordly/core/referrals");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("./jestAccountDeletion");
const jestReferralReceipts_1 = require("./jestReferralReceipts");
const jestSecurity_1 = require("./jestSecurity");
const jestUser_1 = require("./jestUser");
/** Grants referral rewards without recreating either side of a deleted Jest identity. */
async function grantJestReferralRewards(firestore, playerId, uniqueConversions, ungrantedCandidates) {
    /** Provides uid behavior. */
    const uid = (0, jestSecurity_1.jestFirebaseUid)(playerId);
    /** Provides r ref. */
    const userRef = firestore.collection("users").doc(uid);
    /** Provides verification ref behavior. */
    const verificationRef = firestore
        .collection("jestReferralVerifications")
        .doc((0, jestReferralReceipts_1.createJestReferralVerificationId)(playerId));
    /** Provides reward ref for behavior. */
    const rewardRefFor = (conversion) => firestore.collection("jestReferralRewards").doc((0, jestReferralReceipts_1.createJestReferralRewardId)(playerId, conversion.playerId));
    /** Provides result behavior. */
    let result = { rewardsGranted: 0, newCoins: 0 };
    await firestore.runTransaction(async (transaction) => {
        /** Provides candidate reward refs behavior. */
        const candidateRewardRefs = ungrantedCandidates.map(rewardRefFor);
        /** Provides [user snapshot, deletion snapshot, reward snapshots] behavior. */
        const [userSnapshot, deletionSnapshot, rewardSnapshots] = await Promise.all([
            transaction.get(userRef),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, uid)),
            Promise.all(candidateRewardRefs.map((rewardRef) => transaction.get(rewardRef))),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletionSnapshot);
        /** Provides ungranted behavior. */
        const ungranted = ungrantedCandidates.filter((_conversion, index) => !rewardSnapshots[index].exists);
        /** Provides referred user refs behavior. */
        const referredUserRefs = ungranted.map((conversion) => firestore.collection("users").doc((0, jestSecurity_1.jestFirebaseUid)(conversion.playerId)));
        /** Provides [referred user snapshots, referred deletion snapshots] behavior. */
        const [referredUserSnapshots, referredDeletionSnapshots] = await Promise.all([
            Promise.all(referredUserRefs.map((referredUserRef) => transaction.get(referredUserRef))),
            Promise.all(ungranted.map((conversion) => transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, (0, jestSecurity_1.jestFirebaseUid)(conversion.playerId))))),
        ]);
        /** Provides eligible behavior. */
        const eligible = ungranted.flatMap((conversion, index) => referredDeletionSnapshots[index].exists
            ? []
            : [
                {
                    conversion,
                    referredSnapshot: referredUserSnapshots[index],
                    referredUserRef: referredUserRefs[index],
                    rewardRef: rewardRefFor(conversion),
                },
            ]);
        /** Provides existing user behavior. */
        const existingUser = userSnapshot.exists ? userSnapshot.data() : undefined;
        /** Provides current coins behavior. */
        const currentCoins = typeof existingUser?.coins === "number" ? existingUser.coins : 0;
        result = {
            rewardsGranted: eligible.length,
            newCoins: currentCoins + eligible.length * referrals_1.JEST_REFERRAL_REWARD_COINS,
        };
        if (eligible.length > 0) {
            /** Provides r. */
            const user = existingUser ?? (0, jestUser_1.createReservedJestUser)(transaction, firestore, uid, playerId);
            if (userSnapshot.exists)
                transaction.update(userRef, { coins: result.newCoins, lastLogin: Date.now() });
            else
                transaction.create(userRef, { ...user, coins: result.newCoins });
            eligible.forEach(({ conversion, referredSnapshot, referredUserRef, rewardRef }) => {
                /** Provides referred uid behavior. */
                const referredUid = (0, jestSecurity_1.jestFirebaseUid)(conversion.playerId);
                /** Provides referred user behavior. */
                const referredUser = referredSnapshot.exists
                    ? referredSnapshot.data()
                    : (0, jestUser_1.createReservedJestUser)(transaction, firestore, referredUid, conversion.playerId);
                /** Provides referred coins behavior. */
                const referredCoins = typeof referredUser.coins === "number" ? referredUser.coins : 0;
                if (referredSnapshot.exists) {
                    transaction.update(referredUserRef, {
                        coins: referredCoins + referrals_1.JEST_REFERRAL_REWARD_COINS,
                        lastLogin: Date.now(),
                    });
                }
                else {
                    transaction.create(referredUserRef, {
                        ...referredUser,
                        coins: referredCoins + referrals_1.JEST_REFERRAL_REWARD_COINS,
                    });
                }
                transaction.create(rewardRef, {
                    replayProtection: true,
                    reference: conversion.reference,
                    inviterCoins: referrals_1.JEST_REFERRAL_REWARD_COINS,
                    referredCoins: referrals_1.JEST_REFERRAL_REWARD_COINS,
                    grantedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        }
        transaction.set(verificationRef, {
            schemaVersion: 1,
            references: [...new Set(uniqueConversions.map((conversion) => conversion.reference))],
            conversionCount: uniqueConversions.length,
            verifiedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    return result;
}
//# sourceMappingURL=jestReferralGrant.js.map