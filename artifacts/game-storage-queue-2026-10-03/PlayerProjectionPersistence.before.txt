import type {PlatformPreferences, PlatformStorage, PlayerData, PlayerDataUpdate} from "./types";

/** Owns version assembly and durable ordering for one client-owned player projection. */
export class PlayerProjectionPersistence {
  /** Stores storage. */
  private readonly storage: PlatformStorage;
  /** Stores projection. */
  private projection: PlayerData | null;
  /** Stores preferences. */
  private preferences: PlatformPreferences;
  /** Stores pending. */
  private pending: Promise<void> = Promise.resolve();
  /** Accepted changes remain retryable until the adapter acknowledges durability. */
  private projectionDirty = false;
  /** Preferences are merged in queue order, including changes whose write failed. */
  private preferencesDirty = false;
  /** Stores accepting. */
  private accepting = true;

  /** Creates a player projection persistence instance. */
  constructor(
    storage: PlatformStorage,
    initial: PlayerData | null,
    initialPreferences: PlatformPreferences = {},
  ) {
    this.storage = storage;
    this.projection = initial;
    this.preferences = initialPreferences;
  }

  /** Reports each operation's failure without poisoning later accepted operations. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    /** Caller observes failure while the private queue tail always settles. */
    const result = this.pending.then(operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Retries the latest accepted player projection and acknowledges it only after flush. */
  private async writeProjection(): Promise<void> {
    if (!this.projectionDirty || !this.projection) return;
    await this.storage.writePlayerData(this.projection);
    await this.storage.flush();
    this.projectionDirty = false;
  }

  /** Retries the merged preference projection without losing earlier accepted changes. */
  private async writePreferences(): Promise<void> {
    if (!this.preferencesDirty) return;
    await this.storage.writePreferences(this.preferences);
    await this.storage.flush();
    this.preferencesDirty = false;
  }

  /** Merges, versions, writes, and flushes one update in call order. */
  update(update: PlayerDataUpdate): Promise<void> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    /** Captures accepted fields before the asynchronous merge. */
    const change = {...update};
    return this.enqueue(async () => {
      this.projection = {
        ...(this.projection ?? {}),
        ...change,
        schemaVersion: 1,
        updatedAt: Date.now(),
      };
      this.projectionDirty = true;
      await this.writeProjection();
    });
  }

  /** Merges and durably orders one preference update. */
  updatePreferences(change: PlatformPreferences): Promise<PlatformPreferences> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    /** Captures the caller's preference patch before the asynchronous merge. */
    const acceptedChange = {...change};
    return this.enqueue(async () => {
      this.preferences = {...this.preferences, ...acceptedChange};
      this.preferencesDirty = true;
      await this.writePreferences();
      return this.preferences;
    });
  }

  /** Waits for every accepted update and the target adapter. */
  flush(): Promise<void> {
    return this.enqueue(async () => {
      await this.writeProjection();
      await this.writePreferences();
      await this.storage.flush();
    });
  }

  /** Stops new writes and drains everything accepted before account deletion. */
  closeAndFlush(): Promise<void> {
    this.accepting = false;
    return this.flush();
  }

  /** Clears the in-memory projection after the target adapter is cleared. */
  clear(): Promise<void> {
    return this.enqueue(async () => {
      await this.storage.clear();
      this.projection = null;
      this.preferences = {};
      this.projectionDirty = false;
      this.preferencesDirty = false;
    });
  }
}
