import type {AccountDeletionServiceGate} from "./accountDeletionServiceGate";
import {readBrowserStorage, writeBrowserStorage} from "../../../platform/browser/storage/browserStorage";

/** Describes cross context lock. */
type CrossContextLock = {
  /** Provides run shared behavior. */
  runShared<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Provides run exclusive behavior. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Provider-owned locks keep unrelated game targets independent. */
type ProviderScope = "facebook" | "reddit";
/** Durable lifetime marker shared by tabs of one target. */
const epochKey = (scope: ProviderScope) => `riddleQuest:${scope}AccountDeletionEpoch:v1`;
/** Every lifetime remains distinguishable after storage is erased. */
const createEpoch = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

/** Creates browser lock. */
const createBrowserLock = (scope: ProviderScope): CrossContextLock | null => {
  /** Provides locks behavior. */
  const locks = globalThis.navigator?.locks;
  if (!locks) return null;
  return {
    runShared: (operation) => locks.request(`riddleQuest:${scope}PlayerOperations:v1`, {mode: "shared"}, operation),
    runExclusive: (operation) => locks.request(`riddleQuest:${scope}PlayerOperations:v1`, {mode: "exclusive"}, operation),
  };
};

/**
 * Serializes provider player work and permanently closes every same-origin tab
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
    scope = "facebook",
    crossContextLock = createBrowserLock(scope),
    requireCrossContextLock = typeof window !== "undefined" && globalThis.isSecureContext === true,
    readEpoch = () => readBrowserStorage("local", epochKey(scope)),
    writeEpoch = value => {writeBrowserStorage("local", epochKey(scope), value);},
  }: {
    /** Isolates each provider's operation lock and deletion lifetime. */
    scope?: ProviderScope;
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
    const existingEpoch = readEpoch();
    if (existingEpoch === null) writeEpoch(createEpoch());
    // Every live tab observes a nonempty epoch, so clearing storage cannot revive an older tab.
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
    this.writeEpoch(createEpoch());
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
