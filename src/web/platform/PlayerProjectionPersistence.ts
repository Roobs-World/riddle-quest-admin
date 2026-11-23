import type {PlatformPreferences, PlatformStorage, PlayerData, PlayerDataUpdate} from "./types";
import {PlayerSaveRecovery} from "./PlayerSaveRecovery";

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
  /** Contiguous player changes waiting to start share one merged durability acknowledgement. */
  private queuedProjection: {
    /** Latest accepted values for each player field. */ change: PlayerDataUpdate;
    /** Settles only after the merged snapshot is written and flushed. */ result: Promise<void>;
  } | null = null;
  /** Accepted changes remain retryable until the adapter acknowledges durability. */
  private projectionDirty = false;
  /** Preferences are merged in queue order, including changes whose write failed. */
  private preferencesDirty = false;
  /** Stores accepting. */
  private accepting = true;
  /** Accepted queue positions must settle before the notice can acknowledge all latest state. */
  private outstanding = 0;
  /** View-owned availability is retired before queued retries may enter the adapter. */
  private recoveryAvailable: () => boolean = () => false;
  /** Bounded policy shares the existing durability queue and target ownership gate. */
  readonly recovery = new PlayerSaveRecovery(() => this.retryDirty(), () => this.accepting && this.recoveryAvailable());
  /** Optional target ownership gate guards normal mutations when their queue position executes. */
  private readonly operationGate?: {
    /** Checks account ownership before merging and persisting an accepted update. */
    run<Result>(operation: () => Promise<Result>): Promise<Result>;
  };

  /** Creates a player projection persistence instance. */
  constructor(
    storage: PlatformStorage,
    initial: PlayerData | null,
    initialPreferences: PlatformPreferences = {},
    operationGate?: PlayerProjectionPersistence["operationGate"],
  ) {
    this.storage = storage;
    this.projection = initial;
    this.preferences = initialPreferences;
    this.operationGate = operationGate;
  }

  /** Normal mutations enter the target gate once per queued operation, after coalescing. */
  private runUpdate<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.operationGate ? this.operationGate.run(operation) : operation();
  }

  /** Reports each operation's failure without poisoning later accepted operations. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    /** Preferences, flush and clear preserve their positions between player updates. */
    this.queuedProjection = null;
    /** Caller observes failure while the private queue tail always settles. */
    this.outstanding++;
    /** Caller-visible failure stays separate from the always-settled private tail. */
    const result = this.pending.then(operation);
    this.pending = result.then(() => this.settled(false), () => this.settled(true));
    return result;
  }

  /** Starts retry scheduling only for the view currently owning this persistence instance. */
  attachRecovery(available: () => boolean): void {
    this.recoveryAvailable = available;
    this.recovery.attach();
    if (this.projectionDirty || this.preferencesDirty) this.recovery.failed();
  }

  /** Cancels automatic work without discarding already accepted durability operations. */
  detachRecovery(): void {
    this.recoveryAvailable = () => false;
    this.recovery.detach();
  }

  /** Older successful saves cannot acknowledge newer waiting updates or failed preferences. */
  private settled(failed: boolean): void {
    this.outstanding--;
    if (!this.accepting) return;
    if (failed && (this.projectionDirty || this.preferencesDirty)) this.recovery.failed();
    else if (this.outstanding === 0 && !this.projectionDirty && !this.preferencesDirty) this.recovery.recovered();
  }

  /** Rechecks lifetime and target ownership after earlier queue work and lock acquisition. */
  private retryDirty(): Promise<void> {
    /** Detach/reattach of the same owner must not revive a retry from the previous view. */
    const available = this.recoveryAvailable;
    return this.enqueue(() => this.runUpdate(async () => {
      if (!this.accepting || available !== this.recoveryAvailable || !available()) return;
      await this.writeProjection();
      /** A projection acknowledgement may complete after this view or account retires. */
      if (!this.accepting || available !== this.recoveryAvailable || !available()) return;
      await this.writePreferences();
    }));
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

  /** Merges waiting updates in call order; callers share acknowledgement of the latest durable snapshot. */
  update(update: PlayerDataUpdate): Promise<void> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    if (this.queuedProjection) {
      this.queuedProjection.change = {...this.queuedProjection.change, ...update};
      return this.queuedProjection.result;
    }
    /** In-flight snapshots stay unchanged; only the next queued snapshot can be replaced. */
    const batch = {change: {...update}, result: Promise.resolve()};
    batch.result = this.enqueue(async () => {
      try {
        await this.runUpdate(async () => {
          if (this.queuedProjection === batch) this.queuedProjection = null;
          this.projection = {
            ...(this.projection ?? {}), ...batch.change, schemaVersion: 1, updatedAt: Date.now(),
          };
          this.projectionDirty = true;
          await this.writeProjection();
        });
      } finally {
        /** A rejected target gate must not leave later updates sharing a failed batch. */
        if (this.queuedProjection === batch) this.queuedProjection = null;
      }
    });
    this.queuedProjection = batch;
    return batch.result;
  }

  /** Merges and durably orders one preference update. */
  updatePreferences(change: PlatformPreferences): Promise<PlatformPreferences> {
    if (!this.accepting) return Promise.reject(new Error("player-projection-persistence-closed"));
    /** Captures the caller's preference patch before the asynchronous merge. */
    const acceptedChange = {...change};
    return this.enqueue(() => this.runUpdate(async () => {
      this.preferences = {...this.preferences, ...acceptedChange};
      this.preferencesDirty = true;
      await this.writePreferences();
      return this.preferences;
    }));
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
    this.detachRecovery();
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
