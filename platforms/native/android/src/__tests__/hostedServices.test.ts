import {describe, expect, it} from "@jest/globals";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {createAndroidHostAuth, createAndroidHostServices} from "../hosted/hostedServices";

/** Fake user with the metadata the shared services read when mapping it. */
const user = {uid: "device-uid", isAnonymous: true, metadata: {creationTime: "2026-11-01T00:00:00Z"}, displayName: null, email: null, photoURL: null} as never;
/** Recorded client calls. */
const recorded: string[] = [];
/** Fake client whose auth surface records how the shared services drive it. */
const client: HostedFirebaseClient = {
  projectId: "riddle-quest-test",
  usingEmulators: true,
  functions: {} as never,
  currentUser: () => user,
  onUserChanged: (listener) => {
    recorded.push("onUserChanged");
    listener(user);
    return () => recorded.push("unsubscribed");
  },
  signInAnonymously: async () => user,
  signOut: async () => {
    recorded.push("signOut");
  },
  loadUserDocument: async (userId) => {
    recorded.push(`loadUserDocument:${userId}`);
    return {coins: 300, username: "Android"};
  },
  provisionAccount: async () => ({uid: "device-uid", created: false, coins: 300}),
  purchases: {} as never,
};

describe("createAndroidHostAuth", () => {
  it("exposes the live SDK user and forwards listeners and sign-out", async () => {
    recorded.length = 0;
    /** Auth surface under test. */
    const auth = createAndroidHostAuth(client);
    expect(auth.currentUser).toBe(user);
    /** Users the listener received. */
    const seen: unknown[] = [];
    /** Unsubscribe handle. */
    const stop = auth.onUserChanged((next) => seen.push(next));
    stop();
    await auth.signOut();
    expect(seen).toEqual([user]);
    expect(recorded).toEqual(["onUserChanged", "unsubscribed", "signOut"]);
  });
});

describe("createAndroidHostServices", () => {
  it("builds the shared services on the device auth and profile reads, defaulting host copy to English", async () => {
    recorded.length = 0;
    /** Services under test. */
    const services = createAndroidHostServices(client);
    /** Snapshots the services published. */
    const snapshots: unknown[] = [];
    /** Unsubscribe handle. */
    const stop = services.auth.subscribe((snapshot) => snapshots.push(snapshot));
    await new Promise((resolve) => setTimeout(resolve, 0));
    stop();
    expect(recorded).toContain("onUserChanged");
    expect(recorded).toContain("loadUserDocument:device-uid");
    expect(snapshots.length).toBeGreaterThan(0);
  });
});
