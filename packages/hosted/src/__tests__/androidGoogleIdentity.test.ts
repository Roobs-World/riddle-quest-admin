import {describe, expect, it} from "@jest/globals";
import {createAndroidGoogleIdentity, createGoogleAccountController} from "../identity/androidGoogleIdentity";

/** Transport fixture records account authority transitions without mocking shared control flow. */
function fixture({conflicting = false, unavailable = false, signInComplete = Promise.resolve(), signOutComplete = Promise.resolve(), linkComplete = Promise.resolve()} = {}) {
  /** Current account reported exclusively by the authentication adapter. */
  let account: {
    /** Authentication account currently selected by this fixture. */
    uid: string;
    /** Whether its Google credential was attached without changing account ownership. */
    googleLinked: boolean;
  } | null = {uid: "original", googleLinked: false};
  /** Exact adapter ordering exposes accidental sign-in before explicit consent. */
  const calls: string[] = [];
  /** Test-owned wall clock controls memory-only conflict expiry. */
  let now = 1000;
  /** Shared identity workflow under test. */
  const identity = createAndroidGoogleIdentity({
    available: !unavailable, current: () => account, now: () => now,
    pick: async () => {calls.push("pick"); return "token";}, credential: token => token,
    link: async uid => {calls.push(`link:${uid}`); if (conflicting) throw Object.assign(Error("existing"), {code: "auth/credential-already-in-use"}); account = {uid, googleLinked: true}; await linkComplete;},
    verifyGoogle: async uid => {calls.push(`verify:${uid}`);},
    signIn: async () => {calls.push("signIn"); account = {uid: "existing", googleLinked: true}; await signInComplete; return "existing";},
    provision: async () => {calls.push("provision");},
    signOut: async () => {calls.push("signOut"); account = null; await signOutComplete; return {kind: "committed", uid: null};},
  });
  return {identity, calls, account: () => account, replace: (uid: string) => {account = {uid, googleLinked: true};}, expire: () => {now += 120_001;}};
}

describe("durable native Google account", () => {
  it("links without replacing the uid and verifies the Google claim before provisioning", async () => {
    /** Real shared workflow is driven through its public identity adapter. */
    const f = fixture();
    await expect(f.identity.link("original", () => true)).resolves.toBe("linked");
    expect(f.account()).toEqual({uid: "original", googleLinked: true});
    expect(f.calls).toEqual(["pick", "link:original", "verify:original", "provision"]);
  });

  it("preserves the original account through a conflict until the player explicitly switches", async () => {
    /** A Google credential already belongs to another durable account. */
    const f = fixture({conflicting: true});
    await expect(f.identity.link("original", () => true)).resolves.toBe("conflict");
    expect(f.account()?.uid).toBe("original"); expect(f.calls).not.toContain("signIn");
    await f.identity.openExisting("original", () => true);
    expect(f.account()?.uid).toBe("existing");
    expect(f.calls.slice(-3)).toEqual(["signIn", "verify:existing", "provision"]);
  });

  it.each(["cancel", "expire"])("cannot reopen a conflict after %s", async mode => {
    /** An expired or dismissed choice never authorizes a future account switch. */
    const f = fixture({conflicting: true});
    await f.identity.link("original", () => true);
    if (mode === "cancel") f.identity.cancelConflict("original"); else f.expire();
    await expect(f.identity.openExisting("original", () => true)).rejects.toThrow("google-conflict-expired");
    expect(f.account()?.uid).toBe("original"); expect(f.calls).not.toContain("signIn");
  });

  it("drops a native credential returned after the account visit retires", async () => {
    /** Device response remains pending while the account screen is dismissed. */
    let finish: (token: string) => void = () => undefined;
    /** Only the selected native response is delayed; the shared workflow is real. */
    const picker = new Promise<string>(resolve => {finish = resolve;});
    /** Lifecycle callback belongs to this one profile visit. */
    let active = true, linked = false;
    /** A retired result must never reach Firebase account mutation. */
    const identity = createAndroidGoogleIdentity({available: true, current: () => ({uid: "original", googleLinked: false}), pick: () => picker,
      credential: value => value, link: async () => {linked = true;}, verifyGoogle: async () => undefined,
      signIn: async () => "existing", provision: async () => undefined, signOut: async () => ({kind: "cancelled"})});
    /** Selection starts while the original account visit is still owned. */
    const result = identity.link("original", () => active);
    active = false; finish("token");
    await expect(result).resolves.toBe("cancelled"); expect(linked).toBe(false);
  });

  it("publishes sign-out to the root once and never switches a conflict implicitly", async () => {
    /** Existing durable identity can safely sign out without deleting its account. */
    const f = fixture(); await f.identity.link("original", () => true);
    /** Root receives exactly one ownership refresh for this explicit action. */
    let changes = 0;
    /** The view layer observes the shared controller. */
    const controller = createGoogleAccountController({ownerId: "original", identity: f.identity, onChanged: () => {changes++;}});
    controller.enter(); await controller.signOut();
    expect(changes).toBe(1); expect(f.account()).toBeNull();
  });
  it.each([false, true])("reconciles a committed explicit switch after retirement unless another uid supersedes it (%s)", async superseded => {
    /** Firebase can publish its new user before the sign-in promise settles. */
    let finish: () => void = () => undefined;
    /** Deferred SDK completion leaves the real controller free to retire. */
    const signInComplete = new Promise<void>(resolve => {finish = resolve;});
    /** A conflicting selection still requires the controller's separate explicit action. */
    const f = fixture({conflicting: true, signInComplete});
    /** Root observes only the identity whose SDK commit remains current. */
    const changes: (string | null)[] = [];
    /** The shared controller is exercised through the same actions as the native Account view. */
    const controller = createGoogleAccountController({ownerId: "original", identity: f.identity, onChanged: () => {changes.push(f.identity.currentUserId());}});
    controller.enter(); await controller.link();
    expect(controller.getSnapshot()).toBe("conflict");
    /** The player explicitly accepts the existing-account warning before leaving. */
    const result = controller.openExisting();
    expect(f.account()?.uid).toBe("existing");
    controller.dispose(); if (superseded) f.replace("newer"); finish(); await result;
    expect(changes).toEqual(superseded ? [] : ["existing"]);
    expect(f.calls).not.toContain("provision");
  });

  it.each([false, true])("reconciles committed sign-out after retirement without refreshing a replacement uid (%s)", async superseded => {
    /** Sign-out may commit in Auth before its promise returns to the disposed view. */
    let finish: () => void = () => undefined;
    /** Only the adapter completion is delayed. */
    const signOutComplete = new Promise<void>(resolve => {finish = resolve;});
    /** The player begins from a protected account. */
    const f = fixture({signOutComplete}); await f.identity.link("original", () => true);
    /** Account ownership refresh is independent of screen rendering lifetime. */
    const changes: (string | null)[] = [];
    /** Real shared controller drives the owned adapter. */
    const controller = createGoogleAccountController({ownerId: "original", identity: f.identity, onChanged: () => {changes.push(f.identity.currentUserId());}});
    controller.enter();
    /** Explicit sign-out commits before this visit is retired. */
    const result = controller.signOut();
    expect(f.account()).toBeNull(); controller.dispose();
    if (superseded) f.replace("newer"); finish(); await result;
    expect(changes).toEqual(superseded ? [] : [null]);
  });

  it("finishes verification and root reconciliation after a uid-preserving link commits and the view retires", async () => {
    /** Firebase has accepted the link while its result remains pending. */
    let finish: () => void = () => undefined;
    /** Retiring a view cannot leave its accepted durable provider unverified. */
    const linkComplete = new Promise<void>(resolve => {finish = resolve;});
    /** The real shared workflow retains the original uid throughout linking. */
    const f = fixture({linkComplete});
    /** Root must see the newly protected account once. */
    let changes = 0;
    /** Rendering retirement invalidates UI updates but not an already committed Auth result. */
    const controller = createGoogleAccountController({ownerId: "original", identity: f.identity, onChanged: () => {changes++;}});
    controller.enter();
    /** Advance through native credential selection to Firebase's accepted link. */
    const result = controller.link(); await Promise.resolve();
    expect(f.account()).toEqual({uid: "original", googleLinked: true});
    controller.dispose(); finish(); await result;
    expect(f.calls).toEqual(["pick", "link:original", "verify:original", "provision"]);
    expect(changes).toBe(1);
  });

});
