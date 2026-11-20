import {describe, expect, it} from "@jest/globals";
import {ANDROID_ENTRY_INBOX_KEY, AndroidEntryInbox, androidInviteStoreUrl, parseAndroidInstallEntry, parseAndroidInviteEntry, type AndroidEntryStorage} from "../androidEntryInbox";

/** Exact opaque URLs stand in for server-issued, independently verified invitations. */
const referral = `riddlequest://referral?token=${"a".repeat(43)}`;
/** A distinct race entry verifies source precedence rather than token equality. */
const race = `riddlequest://race?challengeId=live_${"b".repeat(64)}`;
/** Mirrors Play's decoded referrer string, preserving the exact nested entry URL. */
const receipt = (url: string) => `rq_entry=${encodeURIComponent(url)}`;
/** Device storage shared by successive controller lifetimes. */
function memory() {
  /** Device-private in-memory records shared by the test controller lifetimes. */
  const values = new Map<string, string>();
  /** Injected async storage port with the same whole-record semantics as AsyncStorage. */
  const storage: AndroidEntryStorage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => {values.set(key, value);},
  };
  return {storage, values};
}
/** Releases one deliberately slow operation without timers or provider mocks. */
function deferred() {
  /** Deterministic completion callback for the deliberately delayed operation. */
  let release = () => {};
  /** Pending operation released explicitly to verify ordering without timers. */
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, release};
}

describe("Android invitation handoff", () => {
  it("decodes the generated Play fallback into an explicit pending preview and stores no campaign metadata", async () => {
    /** Shared device storage retained across simulated process lifetimes. */
    const device = memory();
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox(device.storage);
    /** Generated Play fallback whose decoded payload must match the original app entry. */
    const store = new URL(androidInviteStoreUrl(referral));
    expect(store.origin).toBe("https://play.google.com");
    expect(store.searchParams.get("id")).toBe("com.roobsworld.riddlequest");
    await inbox.receiveInstallReferrer(`${store.searchParams.get("referrer")}&utm_campaign=unrelated-private-value`);
    expect(inbox.getSnapshot()?.entry).toEqual({kind: "referral", token: "a".repeat(43), url: referral});
    expect(device.values.get(ANDROID_ENTRY_INBOX_KEY)).not.toContain("utm_campaign");
    expect(device.values.get(ANDROID_ENTRY_INBOX_KEY)).not.toContain("unrelated-private-value");
  });
  it("restores a pending preview on ordinary cold launch and never replays a handled Play receipt", async () => {
    /** Shared device storage retained across simulated process lifetimes. */
    const device = memory();
    /** Initial controller lifetime before the simulated process restart. */
    const first = new AndroidEntryInbox(device.storage);
    await first.receiveInstallReferrer(receipt(race));
    /** Exact pending handle and preview that must survive a cold launch. */
    const original = first.getSnapshot();
    expect(original).not.toBeNull();
    /** New controller lifetime hydrating the same device-private storage. */
    const cold = new AndroidEntryInbox(device.storage);
    await cold.load();
    expect(cold.getSnapshot()).toEqual(original);
    await cold.receiveInstallReferrer(receipt(race));
    expect(cold.getSnapshot()).toEqual(original);
    if (!original) throw new Error("expected preview");
    await cold.acknowledge(original.id);
    /** Fresh lifetime checking that a consumed installation receipt stays consumed. */
    const handled = new AndroidEntryInbox(device.storage);
    await handled.receiveInstallReferrer(receipt(race));
    expect(handled.getSnapshot()).toBeNull();
  });
  it("gives direct input precedence over a late install result, while consuming only its canonical receipt", async () => {
    /** Shared device storage retained across simulated process lifetimes. */
    const device = memory();
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox(device.storage);
    await inbox.receiveDirect(race);
    /** Newer direct input that must outrank optional installation metadata. */
    const direct = inbox.getSnapshot();
    await inbox.receiveInstallReferrer(receipt(referral));
    expect(inbox.getSnapshot()).toEqual(direct);
    if (!direct) throw new Error("expected direct preview");
    await inbox.acknowledge(direct.id);
    /** New controller lifetime hydrating the same device-private storage. */
    const cold = new AndroidEntryInbox(device.storage);
    await cold.receiveInstallReferrer(receipt(referral));
    expect(cold.getSnapshot()).toBeNull();
  });
  it("never publishes an obsolete install preview when direct input arrives during its storage write", async () => {
    /** Shared device storage retained across simulated process lifetimes. */
    const device = memory();
    /** Storage write completion deliberately held while newer input arrives. */
    const blocked = deferred();
    /** Signal proving the install write reached the vulnerable await boundary. */
    const started = deferred();
    /** Limits the artificial storage delay to the initial install commit. */
    let firstWrite = true;
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox({...device.storage, setItem: async (key, value) => {
      if (firstWrite) {firstWrite = false; started.release(); await blocked.promise;}
      await device.storage.setItem(key, value);
    }});
    /** Published navigation history used to reject obsolete installation previews. */
    const seen: (string | null)[] = [];
    inbox.subscribe(() => {seen.push(inbox.getSnapshot()?.entry.url ?? null);});
    /** Optional installation delivery awaiting the same serialized storage chain. */
    const install = inbox.receiveInstallReferrer(receipt(referral));
    await started.promise;
    /** Newer direct input that must outrank optional installation metadata. */
    const direct = inbox.receiveDirect(race);
    blocked.release();
    await Promise.all([install, direct]);
    expect(seen).not.toContain(referral);
    expect(inbox.getSnapshot()?.entry.url).toBe(race);
  });
  it("keeps newer pending input when an old screen accepts or dismisses, and deduplicates repeated pending links", async () => {
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox(memory().storage);
    await inbox.receiveDirect(referral);
    /** Earlier preview handle used to exercise stale acknowledgement. */
    const old = inbox.getSnapshot();
    await inbox.receiveDirect(referral);
    expect(inbox.getSnapshot()).toEqual(old);
    await inbox.receiveDirect(race);
    /** Latest pending preview that an old callback must preserve. */
    const newer = inbox.getSnapshot();
    if (!old) throw new Error("expected old preview");
    await inbox.acknowledge(old.id);
    expect(inbox.getSnapshot()).toEqual(newer);
  });
  it("rejects malformed, duplicated, oversized and arbitrary referrer destinations", async () => {
    for (const raw of [null, "", "rq_entry=https%3A%2F%2Fevil.example", "rq_entry=%", `${receipt(referral)}&${receipt(race)}`, receipt(`${race}&evil=1`), "x".repeat(4097), receipt(`riddlequest://referral?token=${"a".repeat(42)}`)]) {
      expect(parseAndroidInstallEntry(raw)).toBeNull();
    }
    expect(parseAndroidInviteEntry("riddlequest://daily")).toBeNull();
    expect(() => androidInviteStoreUrl("https://evil.example")).toThrow();
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox(memory().storage);
    await inbox.receiveInstallReferrer("rq_entry=%");
    expect(inbox.getSnapshot()).toBeNull();
  });
  it("fails softly on unavailable storage", async () => {
    /** Controller whose storage rejects, verifying fail-soft startup. */
    const unavailable = new AndroidEntryInbox({getItem: async () => {throw new Error("unavailable");}, setItem: async () => {throw new Error("unavailable");}});
    await expect(unavailable.load()).resolves.toBeUndefined();
    await expect(unavailable.receiveDirect(race)).resolves.toBeUndefined();
    expect(unavailable.getSnapshot()).toBeNull();
  });
  it("recovers after a failed atomic write without publishing a half-consumed receipt", async () => {
    /** Shared device storage retained across simulated process lifetimes. */
    const device = memory();
    /** Whether the single injected atomic-write failure has occurred. */
    let failed = false;
    /** Shared entry controller under test, with no server mutation capability. */
    const inbox = new AndroidEntryInbox({...device.storage, setItem: async (key, value) => {
      if (!failed) {failed = true; throw new Error("disk unavailable");}
      await device.storage.setItem(key, value);
    }});
    await inbox.receiveInstallReferrer(receipt(referral));
    expect(inbox.getSnapshot()).toBeNull();
    expect(device.values.size).toBe(0);
    await inbox.receiveInstallReferrer(receipt(referral));
    expect(inbox.getSnapshot()?.entry.url).toBe(referral);
  });
});
