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

  /** Merges, versions, writes, and flushes one update in call order. */
  update(update: PlayerDataUpdate): Promise<void> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    /** Provides next behavior. */
    const next: PlayerData = {
      ...(this.projection ?? {}),
      ...update,
      schemaVersion: 1,
      updatedAt: Date.now(),
    };
    this.projection = next;
    this.pending = this.pending.then(async () => {
      await this.storage.writePlayerData(next);
      await this.storage.flush();
    });
    return this.pending;
  }

  /** Merges and durably orders one preference update. */
  updatePreferences(change: PlatformPreferences): Promise<PlatformPreferences> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    /** Provides next behavior. */
    const next = {...this.preferences, ...change};
    this.pending = this.pending.then(async () => {
      await this.storage.writePreferences(next);
      await this.storage.flush();
      this.preferences = next;
    });
    return this.pending.then(() => next);
  }

  /** Waits for every accepted update and the target adapter. */
  async flush(): Promise<void> {
    await this.pending;
    await this.storage.flush();
  }

  /** Stops new writes and drains everything accepted before account deletion. */
  closeAndFlush(): Promise<void> {
    this.accepting = false;
    return this.flush();
  }

  /** Clears the in-memory projection after the target adapter is cleared. */
  async clear(): Promise<void> {
    await this.pending;
    await this.storage.clear();
    this.projection = null;
    this.preferences = {};
  }
}
