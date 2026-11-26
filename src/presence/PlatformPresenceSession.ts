/** Describes active presence state. */
export type ActivePresenceState = "online" | "playing" | "racing";
/** Describes presence state. */
export type PresenceState = "offline" | ActivePresenceState;

/** Describes presence connection. */
export type PresenceConnection = {
  /** Stores session id. */
  sessionId: string;
  /** Stores platform. */
  platform: "jest";
  /** Stores state. */
  state: ActivePresenceState;
  /** Stores updated at ms. */
  updatedAtMs: number;
};

/** Defines the contract for presence transport. */
export interface PresenceTransport {
  /** Provides register behavior. */
  register(connection: PresenceConnection): Promise<void>;
  /** Provides update behavior. */
  update(sessionId: string, state: ActivePresenceState, updatedAtMs: number): Promise<void>;
  /** Provides remove behavior. */
  remove(sessionId: string): Promise<void>;
  /** Provides on reconnect behavior. */
  onReconnect(callback: () => void | Promise<void>): () => void;
  /** Provides arm disconnect removal behavior. */
  armDisconnectRemoval(sessionId: string): Promise<void>;
}

/** Defines the presence priority value. */
const PRESENCE_PRIORITY: Record<PresenceState, number> = {offline: 0, online: 1, playing: 2, racing: 3};

/** Aggregates independent tabs/devices without allowing an idle tab to hide an active race. */
export function aggregatePresence(connections: readonly PresenceConnection[]): PresenceState {
  return connections.reduce<PresenceState>(
    (highest, connection) =>
      PRESENCE_PRIORITY[connection.state] > PRESENCE_PRIORITY[highest] ? connection.state : highest,
    "offline",
  );
}

/** Owns one opt-in browser connection and its reconnect/onDisconnect lifecycle. */
export class PlatformPresenceSession {
  /** Stores state. */
  private state: ActivePresenceState = "online";
  /** Stores active. */
  private active = false;
  /** Stores unsubscribe reconnect. */
  private unsubscribeReconnect?: () => void;
  /** Stores operation queue. */
  private operationQueue: Promise<void> = Promise.resolve();
  /** Stores registration. */
  private registration?: Promise<void>;
  /** Stores transport. */
  private readonly transport: PresenceTransport;
  /** Stores connection. */
  private readonly connection: Omit<PresenceConnection, "state" | "updatedAtMs">;
  /** Stores now. */
  private readonly now: () => number;

  /** Creates a platform presence session instance. */
  constructor(
    transport: PresenceTransport,
    connection: Omit<PresenceConnection, "state" | "updatedAtMs">,
    now: () => number = Date.now,
  ) {
    this.transport = transport;
    this.connection = connection;
    this.now = now;
  }

  /** Provides start behavior. */
  async start(optedIn: boolean): Promise<void> {
    if (!optedIn || this.active) return;
    this.active = true;
    this.unsubscribeReconnect = this.transport.onReconnect(() => this.ensureRegistered());
    try {
      await this.ensureRegistered();
    } catch (error) {
      this.active = false;
      this.unsubscribeReconnect?.();
      this.unsubscribeReconnect = undefined;
      await this.enqueue(async () => {
        await this.transport.remove(this.connection.sessionId);
      }).catch(() => undefined);
      throw error;
    }
  }

  /** Sets state. */
  async setState(state: ActivePresenceState): Promise<void> {
    this.state = state;
    if (!this.active) return;
    await this.enqueue(async () => {
      if (!this.active) return;
      await this.transport.update(this.connection.sessionId, this.state, this.now());
    });
  }

  /** Provides stop behavior. */
  async stop(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = undefined;
    await this.enqueue(async () => {
      await this.transport.remove(this.connection.sessionId);
    });
  }

  /** Provides enqueue behavior. */
  private enqueue(operation: () => Promise<void>): Promise<void> {
    /** Provides result behavior. */
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  /** Ensures registered. */
  private ensureRegistered(): Promise<void> {
    if (this.registration) return this.registration;
    /** Provides operation behavior. */
    const operation = this.enqueue(async () => {
      if (!this.active) return;
      await this.transport.armDisconnectRemoval(this.connection.sessionId);
      if (!this.active) return;
      await this.transport.register({...this.connection, state: this.state, updatedAtMs: this.now()});
    });
    this.registration = operation;
    void operation.then(
      () => {
        if (this.registration === operation) this.registration = undefined;
      },
      () => {
        if (this.registration === operation) this.registration = undefined;
      },
    );
    return operation;
  }
}
