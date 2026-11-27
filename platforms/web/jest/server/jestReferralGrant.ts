import {JEST_REFERRAL_REWARD_COINS} from "./referrals/referralCampaigns.js";
import type {Firestore} from "firebase-admin/firestore";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";
import {
  createJestReferralRewardId,
  createJestReferralVerificationId,
  type JestReferralConversion,
} from "./jestReferralReceipts";
import {jestIdentityRef, readJestIdentity, readActiveJestIdentity} from "./jestIdentity";
import {createReservedJestUser} from "./jestUser";

/** Transaction result for one bounded, tombstone-aware referral grant. */
export type JestReferralGrantResult = {
  /** Number of inviter/invitee reward pairs committed. */
  rewardsGranted: number;
  /** Inviter balance after this grant. */
  newCoins: number;
};

/** Grants referral rewards without recreating either side of a deleted Jest identity. */
export async function grantJestReferralRewards(
  firestore: Firestore,
  playerId: string,
  uniqueConversions: readonly JestReferralConversion[],
  ungrantedCandidates: readonly JestReferralConversion[],
  accountUid?: string,
): Promise<JestReferralGrantResult> {
  /** Provides verification ref behavior. */
  const verificationRef = firestore
    .collection("jestReferralVerifications")
    .doc(createJestReferralVerificationId(playerId));
  /** Provides reward ref for behavior. */
  const rewardRefFor = (conversion: JestReferralConversion) =>
    firestore.collection("jestReferralRewards").doc(createJestReferralRewardId(playerId, conversion.playerId));
  /** Provides result behavior. */
  let result: JestReferralGrantResult = {rewardsGranted: 0, newCoins: 0};
  await firestore.runTransaction(async (transaction) => {
    const {uid} = await readActiveJestIdentity(firestore, transaction, playerId, accountUid);
    const userRef = firestore.collection("users").doc(uid);
    /** Provides candidate reward refs behavior. */
    const candidateRewardRefs = ungrantedCandidates.map(rewardRefFor);
    /** Provides [user snapshot, deletion snapshot, reward snapshots] behavior. */
    const [userSnapshot, deletionSnapshot, rewardSnapshots] = await Promise.all([
      transaction.get(userRef),
      transaction.get(getJestAccountDeletionRef(firestore, uid)),
      Promise.all(candidateRewardRefs.map((rewardRef) => transaction.get(rewardRef))),
    ]);
    assertJestAccountActive(deletionSnapshot);
    /** Provides ungranted behavior. */
    const ungranted = ungrantedCandidates.filter((_conversion, index) => !rewardSnapshots[index].exists);
    const referredIdentities = await Promise.all(ungranted.map(async (conversion) =>
      readJestIdentity(await transaction.get(jestIdentityRef(firestore, conversion.playerId)), conversion.playerId),
    ));
    const referredUserRefs = referredIdentities.map(({uid: referredUid}) => firestore.collection("users").doc(referredUid));
    /** Provides [referred user snapshots, referred deletion snapshots] behavior. */
    const [referredUserSnapshots, referredDeletionSnapshots] = await Promise.all([
      Promise.all(referredUserRefs.map((referredUserRef) => transaction.get(referredUserRef))),
      Promise.all(
        referredIdentities.map((identity) =>
          transaction.get(getJestAccountDeletionRef(firestore, identity.uid)),
        ),
      ),
    ]);
    /** Provides eligible behavior. */
    const eligible = ungranted.flatMap((conversion, index) =>
      referredDeletionSnapshots[index].exists || referredIdentities[index].status !== "active"
        ? []
        : [
            {
              conversion,
              referredSnapshot: referredUserSnapshots[index],
              referredUserRef: referredUserRefs[index],
              rewardRef: rewardRefFor(conversion),
            },
          ],
    );
    /** Provides existing user behavior. */
    const existingUser = userSnapshot.exists ? userSnapshot.data()! : undefined;
    /** Provides current coins behavior. */
    const currentCoins = typeof existingUser?.coins === "number" ? existingUser.coins : 0;
    result = {
      rewardsGranted: eligible.length,
      newCoins: currentCoins + eligible.length * JEST_REFERRAL_REWARD_COINS,
    };
    if (eligible.length > 0) {
      /** Provides r. */
      const user = existingUser ?? createReservedJestUser(transaction, firestore, uid, playerId);
      if (userSnapshot.exists) transaction.update(userRef, {coins: result.newCoins, lastLogin: Date.now()});
      else transaction.create(userRef, {...user, coins: result.newCoins});
      eligible.forEach(({conversion, referredSnapshot, referredUserRef, rewardRef}) => {
        /** Provides referred uid behavior. */
        const referredUid = referredUserRef.id;
        /** Provides referred user behavior. */
        const referredUser = referredSnapshot.exists
          ? referredSnapshot.data()!
          : createReservedJestUser(transaction, firestore, referredUid, conversion.playerId);
        /** Provides referred coins behavior. */
        const referredCoins = typeof referredUser.coins === "number" ? referredUser.coins : 0;
        if (referredSnapshot.exists) {
          transaction.update(referredUserRef, {
            coins: referredCoins + JEST_REFERRAL_REWARD_COINS,
            lastLogin: Date.now(),
          });
        } else {
          transaction.create(referredUserRef, {
            ...referredUser,
            coins: referredCoins + JEST_REFERRAL_REWARD_COINS,
          });
        }
        transaction.create(rewardRef, {
          replayProtection: true,
          reference: conversion.reference,
          inviterCoins: JEST_REFERRAL_REWARD_COINS,
          referredCoins: JEST_REFERRAL_REWARD_COINS,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }
    transaction.set(verificationRef, {
      schemaVersion: 1,
      references: [...new Set(uniqueConversions.map((conversion) => conversion.reference))],
      conversionCount: uniqueConversions.length,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return result;
}
