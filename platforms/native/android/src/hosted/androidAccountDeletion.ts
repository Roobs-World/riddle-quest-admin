import AsyncStorage from "@react-native-async-storage/async-storage";
import {retireAndroidPlayerStorage, startFreshAndroidPlayerStorage} from "./androidPlayerStorage";

/** Retained only until confirmed server deletion has completed its local cleanup. */
export const ANDROID_ACCOUNT_DELETION_KEY = "riddle-quest:android:account-deletion-cleanup";
/** Dependencies keep deletion recovery separate from the native view lifetime. */
export type AndroidAccountDeletionDependencies = Readonly<{
  currentUid(): string | null;
  deleteRemote(): Promise<unknown>;
  signOut(): Promise<void>;
  ready(): Promise<void>;
  storage?: Pick<typeof AsyncStorage, "getItem" | "setItem" | "clear" | "getAllKeys">;
}>;

/** Retries client cleanup without issuing another deletion against a signed-out or replacement account. */
export function createAndroidAccountDeletion(deps: AndroidAccountDeletionDependencies) {
  const storage = deps.storage ?? AsyncStorage;
  let confirmedUid: string | null = null;
  let pending: Promise<boolean> | null = null;
  const cleanup = async (uid: string) => {
    if (deps.currentUid() !== null && deps.currentUid() !== uid) throw new Error("account-deletion-owner-changed");
    await retireAndroidPlayerStorage();
    await storage.setItem(ANDROID_ACCOUNT_DELETION_KEY, uid);
    if (await storage.getItem(ANDROID_ACCOUNT_DELETION_KEY) !== uid) throw new Error("account-deletion-marker-unverified");
    if (deps.currentUid() === uid) await deps.signOut();
    if (deps.currentUid() !== null) throw new Error("account-deletion-sign-out-incomplete");
    try {
      await storage.clear();
      if ((await storage.getAllKeys()).length !== 0) throw new Error("account-deletion-storage-clear-incomplete");
    } catch (error) {
      await storage.setItem(ANDROID_ACCOUNT_DELETION_KEY, uid);
      throw error;
    }
    startFreshAndroidPlayerStorage();
  };
  const exclusive = (operation: () => Promise<boolean>): Promise<boolean> => {
    if (pending) return pending;
    pending = operation().finally(() => {pending = null;});
    return pending;
  };
  return {
    /** A process restart finishes confirmed deletion before any fresh account or game controllers start. */
    recover: () => exclusive(async () => {
      const uid = await storage.getItem(ANDROID_ACCOUNT_DELETION_KEY);
      if (!uid) return false;
      await deps.ready();
      confirmedUid = uid;
      await cleanup(uid);
      confirmedUid = null;
      return true;
    }),
    /** Server acknowledgement precedes sign-out, full device cleanup and the root's fresh session. */
    deleteAccount: () => exclusive(async () => {
      if (!confirmedUid) {
        const uid = deps.currentUid();
        if (!uid) throw new Error("account-deletion-auth-required");
        await deps.deleteRemote();
        confirmedUid = uid;
      }
      await cleanup(confirmedUid);
      confirmedUid = null;
      return true;
    }).then(() => undefined),
  };
}
