import {createHash} from "node:crypto";
import type {DocumentSnapshot, Firestore, Transaction} from "firebase-admin/firestore";
import {JestAccountDeletedError, getJestAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";
import {jestFirebaseUid} from "./jestSecurity";

export type JestAccountIdentity = {
  uid: string;
  accountGeneration: number;
  status: "active" | "deleting" | "deleted";
  lastDeletedUid?: string;
  premiumCoinsGrantedAt?: number;
};

export class JestIdentityDeletedError extends JestAccountDeletedError {
  constructor(readonly deletedUid: string) {
    super();
  }
}

export const jestIdentityRef = (db: Firestore, playerId: string) =>
  db.collection("providerIdentities").doc(createHash("sha256").update(`jest\0${playerId}`).digest("hex"));

export function readJestIdentity(snapshot: Pick<DocumentSnapshot, "exists" | "data">, playerId: string): JestAccountIdentity {
  if (!snapshot.exists) return {uid: jestFirebaseUid(playerId), accountGeneration: 1, status: "active"};
  const data = snapshot.data();
  if (!data || data.provider !== "jest" || typeof data.accountGeneration !== "number" ||
      !Number.isSafeInteger(data.accountGeneration) || data.accountGeneration < 1 ||
      data.uid !== jestFirebaseUid(playerId, data.accountGeneration) ||
      !["active", "deleting", "deleted"].includes(data.status)) {
    throw new Error("jest-provider-identity-conflict");
  }
  return {
    uid: data.uid,
    accountGeneration: data.accountGeneration,
    status: data.status,
    ...(typeof data.lastDeletedUid === "string" ? {lastDeletedUid: data.lastDeletedUid} : {}),
    ...(typeof data.premiumCoinsGrantedAt === "number" && Number.isFinite(data.premiumCoinsGrantedAt)
      ? {premiumCoinsGrantedAt: data.premiumCoinsGrantedAt} : {}),
  };
}

export async function readActiveJestIdentity(
  db: Firestore,
  transaction: Transaction,
  playerId: string,
  accountUid?: string,
): Promise<JestAccountIdentity> {
  const identity = readJestIdentity(await transaction.get(jestIdentityRef(db, playerId)), playerId);
  const deletion = await transaction.get(getJestAccountDeletionRef(db, identity.uid));
  if (identity.status !== "active" || deletion.exists) throw new JestIdentityDeletedError(identity.uid);
  if (accountUid ? accountUid !== identity.uid : identity.accountGeneration !== 1) {
    throw new Error("jest-account-generation-mismatch");
  }
  return identity;
}
