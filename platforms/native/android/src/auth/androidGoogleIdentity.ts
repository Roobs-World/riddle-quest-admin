/** Linking preserves the account; a conflicting existing account requires a separate explicit choice. */
export type GoogleLinkOutcome = "linked" | "cancelled" | "conflict";
/** A committed authentication change must reconcile the root even if its originating screen retired. */
export type GoogleAccountChange =
  | Readonly<{
      /** Authentication was not changed by this operation. */
      kind: "cancelled";
    }>
  | Readonly<{
      /** Firebase accepted this exact authentication change. */
      kind: "committed";
      /** The selected Firebase uid, or null after sign-out. */
      uid: string | null;
    }>;
/** Target-owned Google/Firebase adapter, independent of native views. */
export type AndroidGoogleIdentity = Readonly<{
  /** Configuration and native provider are both present. */ available: boolean;
  /** Current Firebase uid, never a client-selected account id. */ currentUserId: () => string | null;
  /** The signed-in identity has a linked Google provider. */ isLinked: () => boolean;
  /** Links Google without replacing the current account. */ link: (ownerId: string, current: () => boolean) => Promise<GoogleLinkOutcome>;
  /** Explicit consent is required before opening a conflicting existing account. */ openExisting: (ownerId: string, current: () => boolean) => Promise<GoogleAccountChange>;
  /** Leaving the conflict screen discards the credential held only in memory. */ cancelConflict: (ownerId: string) => void;
  /** Clears provider session state and signs out without deleting the durable account. */ signOut: (ownerId: string, current: () => boolean) => Promise<GoogleAccountChange>;
}>;
/** Native credential selection and Firebase verification are injected at the target boundary. */
export function createAndroidGoogleIdentity<Credential>(options: {
  /** Missing optional OAuth configuration disables selection. */ available: boolean;
  /** Only the authenticated SDK reports the active identity. */ current: () => {
    /** Firebase account uid. */
    uid: string;
    /** Google provider is attached to that uid. */
    googleLinked: boolean;
  } | null;
  /** Native Credential Manager returns a token or user cancellation. */ pick: () => Promise<string | null>;
  /** The Firebase adapter constructs its provider credential. */ credential: (idToken: string) => Credential;
  /** Firebase links to the supplied current uid. */ link: (uid: string, credential: Credential) => Promise<void>;
  /** Refreshes a signed Google token without changing the uid. */ verifyGoogle: (uid: string, credential: Credential) => Promise<void>;
  /** Explicit account-switch action signs in to the selected existing Google identity. */ signIn: (credential: Credential) => Promise<string>;
  /** Server provisioning registers the durable subject and confirms the game account. */ provision: () => Promise<unknown>;
  /** Signs out and clears the native provider session. */ signOut: (ownerId: string, current: () => boolean) => Promise<GoogleAccountChange>;
  /** Wall clock bounds memory-only conflict credentials. */ now?: () => number;
}): AndroidGoogleIdentity {
  /** Only a credential confirmed to conflict with this exact uid may authorize a switch. */
  let conflict: {
    /** Owner retained during conflict. */
    ownerId: string;
    /** Verified provider credential held only in memory. */
    credential: Credential;
    /** Bounded time for the explicit choice. */
    expiresAt: number;
  } | null = null;
  /** Multiple views cannot launch competing credential prompts. */
  let busy = false;
  /** Every continuation checks both the visible visit and the authenticated account. */
  const owns = (ownerId: string, current: () => boolean) => current() && options.current()?.uid === ownerId;
  /** Credentials remain local to the current choice and expire before their provider token does. */
  const now = options.now ?? Date.now;
  return {
    available: options.available,
    currentUserId: () => options.current()?.uid ?? null,
    isLinked: () => options.current()?.googleLinked === true,
    /** A link cannot replace the anonymous account when the selected Google identity already exists. */
    async link(ownerId, current) {
      if (busy || !owns(ownerId, current)) return "cancelled";
      if (!options.available) throw new Error("google-sign-in-unavailable");
      busy = true; conflict = null;
      try {
        if (options.current()?.googleLinked) {await options.provision(); return "linked";}
        /** Credential selection never signs out the anonymous game account. */
        const idToken = await options.pick();
        if (idToken === null || !owns(ownerId, current)) return "cancelled";
        /** Firebase verifies the token's signature, issuer and audience. */
        const credential = options.credential(idToken);
        try {await options.link(ownerId, credential);}
        catch (failure) {
          if (owns(ownerId, current) && typeof failure === "object" && failure !== null && "code" in failure &&
              failure.code === "auth/credential-already-in-use") {
            conflict = {ownerId, credential, expiresAt: now() + 2 * 60_000};
            return "conflict";
          }
          throw failure;
        }
        // A committed link keeps the same uid; finish verifying it even if its initiating view retired.
        if (options.current()?.uid !== ownerId) return "cancelled";
        await options.verifyGoogle(ownerId, credential);
        if (options.current()?.uid !== ownerId) return "cancelled";
        await options.provision();
        return "linked";
      } finally {busy = false;}
    },
    /** Only an explicit conflict choice can switch to another uid. */
    async openExisting(ownerId, current) {
      if (busy || !owns(ownerId, current)) throw new Error("google-account-changed");
      /** An account switch consumes the player's exact pending conflict choice once. */
      const selected = conflict;
      conflict = null;
      if (!selected || selected.ownerId !== ownerId || selected.expiresAt <= now()) throw new Error("google-conflict-expired");
      busy = true;
      try {
        /** This call is reachable only from the separately confirmed account-switch action. */
        const uid = await options.signIn(selected.credential);
        if (options.current()?.uid !== uid) return {kind: "cancelled"};
        // Authentication already committed. Root owns retrying provisioning if this screen retires or the follow-up fails.
        if (current()) {
          try {
            await options.verifyGoogle(uid, selected.credential);
            if (current() && options.current()?.uid === uid) await options.provision();
          } catch { /* Return the accepted auth identity so root cannot retain the old account after a follow-up outage. */ }
        }
        return options.current()?.uid === uid ? {kind: "committed", uid} : {kind: "cancelled"};
      } finally {busy = false;}
    },
    /** Discard this account visit’s memory-only conflict credential. */
    cancelConflict(ownerId) {if (conflict?.ownerId === ownerId) conflict = null;},
    /** Delayed native cleanup may sign out only its originating account while its explicit choice is still owned. */
    async signOut(ownerId, current) {
      if (busy || !owns(ownerId, current)) return {kind: "cancelled"};
      busy = true; conflict = null;
      try {return await options.signOut(ownerId, current);} finally {busy = false;}
    },
  };
}

/** Native account rendering observes one complete identity transition at a time. */
export type GoogleAccountStatus = "unavailable" | "anonymous" | "working" | "linked" | "conflict" | "failed";
/** Owns a profile visit's identity operations and explicit conflict choice. */
export function createGoogleAccountController(options: {
  /** The currently confirmed game account. */ ownerId: string;
  /** Missing native/provider configuration remains explicitly unavailable. */ identity?: AndroidGoogleIdentity;
  /** Refreshes root account ownership after an accepted auth change. */ onChanged: () => void;
}) {
  /** Construction is inert until the rendering adapter enters. */
  let active = false;
  /** Account or view retirement invalidates every optional completion callback. */
  let generation = 0;
  /** Linked accounts remain visible even when optional configuration is later removed. */
  const initial = (): GoogleAccountStatus => options.identity?.isLinked() ? "linked" : options.identity?.available ? "anonymous" : "unavailable";
  /** Stable status is consumed through an external-store rendering subscription. */
  let status = initial();
  /** Rendering subscriptions have no authority over account mutations. */
  const listeners = new Set<() => void>();
  /** Complete transition published before optional observers run. */
  const update = (value: GoogleAccountStatus) => {status = value; for (const listener of listeners) listener();};
  /** Every action captures the original confirmed account and screen generation. */
  const run = async (action: "link" | "existing" | "signOut") => {
    if (!active || status === "working" || !options.identity || action === "existing" && status !== "conflict" || action === "signOut" && status !== "linked") return;
    /** Exact adapter remains bound throughout native and Firebase work. */
    const identity = options.identity;
    /** Account changes and screen disposal revoke further UI updates. */
    const expected = generation;
    /** Ownership callback is also checked before the Firebase adapter mutates identity. */
    const current = () => active && generation === expected;
    /** Auth may change even if subsequent provisioning fails; root must still refresh its uid. */
    const wasLinked = identity.isLinked();
    /** Root notification is delivered at most once even if its callback retires the view synchronously. */
    let notified = false;
    /** Publish account changes before another screen can dispatch against the previous uid. */
    const notify = () => {notified = true; options.onChanged();};
    update("working");
    if (!current()) return;
    try {
      if (action !== "link") {
        /** Once Firebase commits, screen retirement cannot suppress root ownership reconciliation. */
        const change = action === "signOut" ? await identity.signOut(options.ownerId, current) : await identity.openExisting(options.ownerId, current);
        if (change.kind === "committed" && identity.currentUserId() === change.uid) {
          if (current()) update(change.uid === null ? "anonymous" : "linked");
          notify();
        } else if (current()) update(initial());
        return;
      }
      /** Initial linking preserves the uid and never admits a conflicting account switch. */
      const outcome = await identity.link(options.ownerId, current);
      if (!current()) return;
      update(outcome === "conflict" ? "conflict" : outcome === "cancelled" ? initial() : "linked");
      if (outcome === "linked") notify();
    } catch {if (current()) update("failed");}
    finally {
      if (action === "link" && !notified && identity.currentUserId() === options.ownerId && identity.isLinked() !== wasLinked) notify();
    }
  };
  return {
    /** Snapshots remain stable until a complete transition occurs. */ getSnapshot: () => status,
    /** Native or browser view owns its own subscription lifetime. */ subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    /** Effect entry supports development setup/cleanup/setup without dispatching during render. */ enter() {active = true; generation++; update(initial());},
    /** Leaving never retains a credential that could silently switch a future account. */ dispose() {active = false; generation++; options.identity?.cancelConflict(options.ownerId);},
    /** Initial selection only attempts to protect the existing uid. */ link: () => run("link"),
    /** Called only after the player reads and accepts the account-switch warning. */ openExisting: () => run("existing"),
    /** Cancelling the conflict preserves the original anonymous account. */ keepCurrent() {if (active && status === "conflict") {options.identity?.cancelConflict(options.ownerId); update(initial());}},
    /** Google-linked progress remains on its durable account after explicit sign-out. */ signOut: () => run("signOut"),
  };
}
