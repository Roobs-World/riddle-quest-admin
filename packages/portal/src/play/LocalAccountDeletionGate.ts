import type {AccountDeletionServiceGate} from "./accountDeletionServiceGate";

/** Describes cross context lock. */
type CrossContextLock = {
  /** Provides run shared behavior. */
  runShared<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Provides run exclusive behavior. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Defines the facebook operation lock value. */
const FACEBOOK_OPERATION_LOCK = "riddleQuest:facebookPlayerOperations:v1";
/** Defines the facebook deletion epoch value. */
const FACEBOOK_DELETION_EPOCH = "riddleQuest:facebookAccountDeletionEpoch:v1";

/** Reads browser epoch. */
const readBrowserEpoch = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(FACEBOOK_DELETION_EPOCH) ?? null;
  } catch {
    return null;
  }
};

/** Provides write browser epoch behavior. */
const writeBrowserEpoch = (epoch: string): void => {
  try {
    globalThis.localStorage?.setItem(FACEBOOK_DELETION_EPOCH, epoch);
  } catch {
    // The in-memory close still prevents this tab from starting more work.
  }
};

/** Creates browser lock. */
const createBrowserLock = (): CrossContextLock | null => {
  /** Provides locks behavior. */
  const locks = globalThis.navigator?.locks;
  if (!locks) return null;
  return {
    runShared: (operation) => locks.request(FACEBOOK_OPERATION_LOCK, {mode: "shared"}, operation),
    runExclusive: (operation) => locks.request(FACEBOOK_OPERATION_LOCK, {mode: "exclusive"}, operation),
  };
};

/**
 * Serializes Facebook player work and permanently closes every same-origin tab
 * through a durable epoch. A secure runtime must expose Web Locks before the
 * destructive operation can run, so an undrainable tab cannot rewrite cloud data.
 */
export class LocalAccountDeletionGate implements AccountDeletionServiceGate {
  /** Stores accepting. */
  private accepting = true;
  /** Stores tail. */
  private tail: Promise<void> = Promise.resolve();
  /** Stores initial epoch. */
  private readonly initialEpoch: string | null;
  /** Stores cross context lock. */
  private readonly crossContextLock: CrossContextLock | null;
  /** Stores require cross context lock. */
  private readonly requireCrossContextLock: boolean;
  /** Stores read epoch. */
  private readonly readEpoch: () => string | null;
  /** Stores write epoch. */
  private readonly writeEpoch: (epoch: string) => void;

  /** Creates a local account deletion gate instance. */
  constructor({
    crossContextLock = createBrowserLock(),
    requireCrossContextLock = typeof window !== "undefined" && globalThis.isSecureContext === true,
    readEpoch = readBrowserEpoch,
    writeEpoch = writeBrowserEpoch,
  }: {
    /** Stores cross context lock. */
    crossContextLock?: CrossContextLock | null;
    /** Stores require cross context lock. */
    requireCrossContextLock?: boolean;
    /** Stores read epoch. */
    readEpoch?: () => string | null;
    /** Stores write epoch. */
    writeEpoch?: (epoch: string) => void;
  } = {}) {
    this.crossContextLock = crossContextLock;
    this.requireCrossContextLock = requireCrossContextLock;
    this.readEpoch = readEpoch;
    this.writeEpoch = writeEpoch;
    this.initialEpoch = readEpoch();
  }

  /** Indicates whether is open. */
  isOpen(): boolean {
    return this.accepting && this.readEpoch() === this.initialEpoch;
  }

  /** Provides close behavior. */
  close(): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.writeEpoch(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  }

  /** Provides run behavior. */
  async run<Result>(operation: () => Promise<Result>): Promise<Result> {
    if (!this.isOpen()) throw new Error("account-deletion-requested");
    /** Provides previous behavior. */
    const previous = this.tail;
    /** Provides release behavior. */
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      /** Provides guarded behavior. */
      const guarded = async (): Promise<Result> => {
        if (!this.isOpen()) throw new Error("account-deletion-requested");
        return operation();
      };
      return this.crossContextLock ? await this.crossContextLock.runShared(guarded) : await guarded();
    } finally {
      release();
    }
  }

  /** Provides run exclusive behavior. */
  async runExclusive(operation: () => Promise<void>): Promise<void> {
    this.close();
    await this.tail;
    if (!this.crossContextLock) {
      if (this.requireCrossContextLock) throw new Error("account-deletion-cross-context-lock-unavailable");
      await operation();
      return;
    }
    await this.crossContextLock.runExclusive(operation);
  }
}
