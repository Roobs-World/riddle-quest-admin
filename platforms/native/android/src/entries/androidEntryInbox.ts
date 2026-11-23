import {AndroidEntryInboxEnvelopeSchema, type AndroidEntryInboxEnvelope} from "./androidEntryInboxSchema";
import {parseAndroidReferralUrl} from "../referrals/androidReferrals";
import {parseLiveRaceInvitationUrl} from "./invitations";
import {createRequestId} from "../../../../../src/hosted/play/requestIds";

/** Validated navigation intent carries no acceptance, account selector or reward. */
export type AndroidInviteEntry =
  | Readonly<{
      /** Discriminates the race destination. */
      kind: "race";
      /** Opaque server-issued private lobby handle, independently checked before joining. */
      challengeId: string;
      /** Canonical app entry accepted by the strict URL parser. */
      url: string;
    }>
  | Readonly<{
      /** Discriminates the referral destination. */
      kind: "referral";
      /** Opaque referral receipt, accepted only by an explicit authenticated server call. */
      token: string;
      /** Canonical app entry accepted by the strict URL parser. */
      url: string;
    }>;
/** A unique local handle lets an old screen acknowledge only the entry it displayed. */
export type PendingAndroidEntry = Readonly<{
  /** Unique local preview handle used for exact acknowledgement. */
  id: string;
  /** Validated opaque invitation data, never authority to join or grant rewards. */
  entry: AndroidInviteEntry;
}>;
/** Async device storage is injected so ordering and cold recovery stay provider neutral. */
export type AndroidEntryStorage = Readonly<{
  /** Reads one private durable envelope before mutation. */
  getItem(key: string): Promise<string | null>;
  /** Atomically replaces the complete private entry envelope. */
  setItem(key: string, value: string): Promise<void>;
}>;
/** Device-private envelope, independent of server account identity and economy. */
export const ANDROID_ENTRY_INBOX_KEY = "riddle-quest:android:entry-inbox-v1";
/** Rejects every URL except an exact recognized opaque race or referral entry. */
export function parseAndroidInviteEntry(url: string): AndroidInviteEntry | null {
  /** Opaque server-issued private lobby handle, independently checked before joining. */
  const challengeId = parseLiveRaceInvitationUrl(url);
  if (challengeId) return {kind: "race", challengeId, url};
  /** Opaque referral receipt, accepted only by an explicit authenticated server call. */
  const token = parseAndroidReferralUrl(url);
  return token ? {kind: "referral", token, url} : null;
}
/** Decodes the Play query once, accepts one rq_entry, and ignores unrelated campaign metadata. */
export function parseAndroidInstallEntry(referrer: string | null): AndroidInviteEntry | null {
  if (!referrer || referrer.length > 4096) return null;
  try {
    /** Decoded query fields used only to select the single recognized entry. */
    const fields = referrer.split("&").map(field => {
      /** First query assignment boundary, retaining encoded data in the value. */
      const separator = field.indexOf("=");
      return separator < 0 ? [decodeURIComponent(field.replace(/\+/g, " ")), ""] :
        [decodeURIComponent(field.slice(0, separator).replace(/\+/g, " ")), decodeURIComponent(field.slice(separator + 1).replace(/\+/g, " "))];
    });
    /** Recognized entry parameters; duplicates are rejected rather than guessed. */
    const entries = fields.filter(([key]) => key === "rq_entry");
    /** One decoded entry URL still requiring the strict invitation parser. */
    const value = entries.length === 1 ? entries[0]?.[1] : undefined;
    return value ? parseAndroidInviteEntry(value) : null;
  } catch {return null;}
}
/** Store fallback preserves only the exact validated opaque app entry. */
export function androidInviteStoreUrl(url: string): string {
  if (!parseAndroidInviteEntry(url)) throw new Error("android-invite-entry-invalid");
  return `https://play.google.com/store/apps/details?id=com.roobsworld.riddlequest&referrer=${encodeURIComponent(`rq_entry=${encodeURIComponent(url)}`)}`;
}
/** Serializes pending entries and consumed receipts in one atomic storage write. */
export class AndroidEntryInbox {
  /** Validated durable state, hydrated before any mutation. */
  private envelope: AndroidEntryInboxEnvelope = {version: 1, pending: null, consumedInstallEntryUrl: null};
  /** Immutable subscribed preview, published only after storage commits. */
  private pending: PendingAndroidEntry | null = null;
  /** Observers are local presentation only. */
  private readonly listeners = new Set<() => void>();
  /** Every read, write and acknowledgement runs on the same chain. */
  private tail: Promise<void> = Promise.resolve();
  /** One load is shared across StrictMode effects and concurrent deliveries. */
  private hydrated = false;
  /** Direct input takes priority immediately, before any storage await. */
  private directRevision = 0;
  /** Adapter writes one whole envelope at a time. */
  private readonly storage: AndroidEntryStorage;
  /** Injected device storage owns persistence rather than a provider SDK. */
  constructor(storage: AndroidEntryStorage) {this.storage = storage;}
  /** Current pending preview for a native external-store subscriber. */
  readonly getSnapshot = (): PendingAndroidEntry | null => this.pending;
  /** Registers a presentation subscriber. */
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  /** Recovers a pending preview without joining, binding or blocking startup. */
  load(): Promise<void> {return this.enqueue(async () => undefined);}
  /** Explicit recognized navigation, including Daily, supersedes an optional installation preview. */
  prioritizeDirectNavigation(): void {this.directRevision++;}
  /** Foreground input wins over late cold-URL or Play results; repeated pending URLs retain their handle. */
  receiveDirect(url: string): Promise<void> {
    /** Validated opaque invitation data, never authority to join or grant rewards. */
    const entry = parseAndroidInviteEntry(url);
    if (!entry) return Promise.resolve();
    this.prioritizeDirectNavigation();
    return this.enqueue(async () => {
      if (this.envelope.pending?.url === url) return;
      await this.commit({...this.envelope, pending: {id: createRequestId("android-entry"), url}});
    });
  }
  /** Records only the canonical entry receipt, even when a newer direct entry supersedes it. */
  receiveInstallReferrer(referrer: string | null): Promise<void> {
    /** Validated opaque invitation data, never authority to join or grant rewards. */
    const entry = parseAndroidInstallEntry(referrer);
    if (!entry) return Promise.resolve();
    /** Direct-input priority captured before optional install work awaits storage. */
    const directRevision = this.directRevision;
    return this.enqueue(async () => {
      if (this.envelope.consumedInstallEntryUrl === entry.url) return;
      /** Existing pending preview takes precedence over an unsolicited installation entry. */
      const pending = this.envelope.pending || this.directRevision !== directRevision || directRevision > 0
        ? this.envelope.pending : {id: createRequestId("android-entry"), url: entry.url};
      await this.commit({...this.envelope, pending, consumedInstallEntryUrl: entry.url}, directRevision);
    });
  }
  /** A stale accept, dismiss or terminal callback cannot clear a newer invitation. */
  acknowledge(id: string): Promise<void> {
    if (this.pending?.id === id) this.directRevision++;
    return this.enqueue(async () => {
      if (this.envelope.pending?.id !== id) return;
      await this.commit({...this.envelope, pending: null});
    });
  }
  /** Contains storage errors so native launch remains usable and the next delivery can retry. */
  private enqueue(operation: () => Promise<void>): Promise<void> {
    /** Serialized storage operation whose failure cannot block native startup. */
    const next = this.tail.then(async () => {await this.hydrate(); await operation();});
    this.tail = next.catch(() => undefined);
    return this.tail;
  }
  /** Parses persisted data at the storage boundary, dropping corrupt or unknown versions. */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    /** Optional stored envelope, bounded before parsing untrusted private data. */
    const raw = await this.storage.getItem(ANDROID_ENTRY_INBOX_KEY);
    if (raw && raw.length <= 8192) {
      try {
        /** Strict schema result used to reject corrupt or unknown persisted records. */
        const parsed = AndroidEntryInboxEnvelopeSchema.safeParse(JSON.parse(raw));
        if (parsed.success) this.envelope = parsed.data;
      } catch { /* Corrupt private data cannot choose arbitrary navigation. */ }
    }
    this.hydrated = true;
    this.publish();
  }
  /** Persists pending entry and receipt together before exposing either change. */
  private async commit(envelope: AndroidEntryInboxEnvelope, expectedDirectRevision?: number): Promise<void> {
    await this.storage.setItem(ANDROID_ENTRY_INBOX_KEY, JSON.stringify(envelope));
    this.envelope = envelope;
    if (expectedDirectRevision === undefined || expectedDirectRevision === this.directRevision) this.publish();
  }
  /** Reconstructs a typed preview from an already validated private envelope. */
  private publish(): void {
    /** Current validated durable preview reconstructed for presentation. */
    const stored = this.envelope.pending;
    /** Validated opaque invitation data, never authority to join or grant rewards. */
    const entry = stored ? parseAndroidInviteEntry(stored.url) : null;
    this.pending = stored && entry ? {id: stored.id, entry} : null;
    this.listeners.forEach(listener => listener());
  }
}
