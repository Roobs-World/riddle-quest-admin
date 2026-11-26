import {afterEach, describe, expect, it} from "@jest/globals";
import {ANDROID_ACCOUNT_DELETION_KEY, createAndroidAccountDeletion} from "../hosted/androidAccountDeletion";
import {createAndroidPlayerStorage, startFreshAndroidPlayerStorage} from "../hosted/androidPlayerStorage";

/** Server and native store boundaries can fail independently during a deletion. */
const fixture = () => {
  const values = new Map<string, string>();
  const state = {uid: "old-account" as string | null, deleted: 0, failDelete: false, failClear: false};
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {values.set(key, value);},
    removeItem: async (key: string) => {values.delete(key);},
    getAllKeys: async () => [...values.keys()],
    clear: async () => {
      if (state.failClear) throw new Error("device-unavailable");
      values.clear();
    },
  };
  const dependencies = {
    currentUid: () => state.uid,
    ready: async () => {},
    deleteRemote: async () => {state.deleted++; if (state.failDelete) throw new Error("server-unavailable");},
    signOut: async () => {state.uid = null;},
    storage,
  };
  return {values, state, storage, dependencies, deletion: createAndroidAccountDeletion(dependencies)};
};

afterEach(() => startFreshAndroidPlayerStorage());

describe("Android account deletion", () => {
  it("clears every private key and prevents retired controllers from restoring deleted state", async () => {
    const {values, state, storage, deletion} = fixture();
    const retired = createAndroidPlayerStorage(storage);
    await retired.setItem("unknown-legacy-key", "private state");
    await retired.setItem("riddle-quest:android:save-v1", "offline progress");
    await deletion.deleteAccount();
    await retired.setItem("unknown-legacy-key", "late write");
    expect(values.size).toBe(0);
    expect(state.uid).toBeNull();
    expect(state.deleted).toBe(1);
    const fresh = createAndroidPlayerStorage(storage);
    await fresh.setItem("new-player", "new save");
    expect(values.get("new-player")).toBe("new save");
  });

  it("retries local cleanup without calling the server after the old identity was signed out", async () => {
    const {values, state, deletion} = fixture();
    values.set("saved-progress", "old");
    state.failClear = true;
    await expect(deletion.deleteAccount()).rejects.toThrow("device-unavailable");
    expect(state.uid).toBeNull();
    expect(values.get(ANDROID_ACCOUNT_DELETION_KEY)).toBe("old-account");
    state.failClear = false;
    await deletion.deleteAccount();
    expect(state.deleted).toBe(1);
    expect(values.size).toBe(0);
  });

  it("resumes confirmed cleanup after a process restart before starting a new account", async () => {
    const {values, state, dependencies} = fixture();
    values.set(ANDROID_ACCOUNT_DELETION_KEY, "old-account");
    values.set("pending-journal", "old attempts");
    const restored = createAndroidAccountDeletion(dependencies);
    await restored.recover();
    expect(state.deleted).toBe(0);
    expect(state.uid).toBeNull();
    expect(values.size).toBe(0);
  });

  it("preserves local progress and identity when the server refuses deletion", async () => {
    const {values, state, deletion} = fixture();
    values.set("saved-progress", "old");
    state.failDelete = true;
    await expect(deletion.deleteAccount()).rejects.toThrow("server-unavailable");
    expect(state.uid).toBe("old-account");
    expect([...values]).toEqual([["saved-progress", "old"]]);
  });

  it("does not clear a replacement account when recovering an old cleanup marker", async () => {
    const {values, state, deletion} = fixture();
    values.set(ANDROID_ACCOUNT_DELETION_KEY, "old-account");
    values.set("saved-progress", "replacement");
    state.uid = "replacement-account";
    await expect(deletion.recover()).rejects.toThrow("account-deletion-owner-changed");
    expect(state.uid).toBe("replacement-account");
    expect(values.get("saved-progress")).toBe("replacement");
  });
});
