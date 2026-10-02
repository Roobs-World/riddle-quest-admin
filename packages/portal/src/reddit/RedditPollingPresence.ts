import type {PresenceCapability, PresenceState} from "../platform/types";

/** Defines the reddit race poll ms value. */
export const REDDIT_RACE_POLL_MS = 2_000;
/** Defines the reddit hub poll ms value. */
export const REDDIT_HUB_POLL_MS = 10_000;

/** Coordinates one lease-backed Reddit session without browser Firebase or sockets. */
export class RedditPollingPresence {
  /** Stores state. */
  private state: Exclude<PresenceState, "offline"> = "online";
  /** Stores enabled. */
  private enabled = false;
  /** Stores timer. */
  private timer?: ReturnType<typeof setTimeout>;
  /** Stores running. */
  private running?: Promise<void>;
  /** Invalidates responses and timers from an earlier consent or visibility state. */
  private generation = 0;
  /** Stores session id. */
  private readonly sessionId: string;
  /** Stores capability. */
  private readonly capability: PresenceCapability;
  /** Stores on rivals. */
  private readonly onRivals: (
    rivals: Array<{
      /** Stores user id. */
      userId: string; /** Stores state. */
      /** Stores state. */
      state: PresenceState;
    }>,
  ) => void;
  /** Stores visibility. */
  private readonly visibility: () => DocumentVisibilityState;

  /** Creates a reddit polling presence instance. */
  constructor(
    capability: PresenceCapability,
    options: {
      /** Stores session id. */
      sessionId?: string;
      /** Stores on rivals. */
      onRivals?: (
        rivals: Array<{
          /** Stores user id. */
          userId: string; /** Stores state. */
          /** Stores state. */
          state: PresenceState;
        }>,
      ) => void;
      /** Stores visibility. */
      visibility?: () => DocumentVisibilityState;
    } = {},
  ) {
    this.capability = capability;
    this.sessionId = options.sessionId ?? crypto.randomUUID().replaceAll("-", "_");
    this.onRivals = options.onRivals ?? (() => undefined);
    this.visibility = options.visibility ?? (() => document.visibilityState);
  }

  /** Sets enabled. */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    /** Correlates this change with the latest desired presence state. */
    const generation = ++this.generation;
    this.clearTimer();
    if (!enabled) this.onRivals([]);
    await this.running?.catch(() => undefined);
    if (generation !== this.generation) return;
    if (!enabled) {
      await this.trackControl(this.capability.poll({sessionId: this.sessionId, state: this.state, enabled: false}).then(() => undefined));
    } else if (this.visibility() === "visible") await this.poll();
  }

  /** Sets state. */
  async setState(state: Exclude<PresenceState, "offline">): Promise<void> {
    this.state = state;
    if (this.enabled && this.visibility() === "visible") {
      /** A state change must follow any request already committed to the server. */
      const generation = ++this.generation;
      this.clearTimer();
      await this.running?.catch(() => undefined);
      if (generation === this.generation) await this.poll();
    }
  }

  /** Provides visibility changed behavior. */
  async visibilityChanged(): Promise<void> {
    /** A pending visible poll must finish before the hidden disconnect. */
    const generation = ++this.generation;
    this.clearTimer();
    this.onRivals([]);
    await this.running?.catch(() => undefined);
    if (generation !== this.generation) return;
    if (!this.enabled) return;
    if (this.visibility() === "hidden") await this.trackControl(this.capability.disconnect(this.sessionId));
    else await this.poll();
  }

  /** Provides stop behavior. */
  async stop(): Promise<void> {
    this.enabled = false;
    /** Supersedes pending reads before removing this session's provider lease. */
    const generation = ++this.generation;
    this.clearTimer();
    this.onRivals([]);
    await this.running?.catch(() => undefined);
    if (generation === this.generation) await this.trackControl(this.capability.disconnect(this.sessionId));
  }

  /** Serializes revocation with future opt-in requests so the last intent owns the server lease. */
  private trackControl(operation: Promise<void>): Promise<void> {
    this.running = operation.finally(() => {this.running = undefined;});
    return this.running;
  }

  /** Clears timer. */
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
  /** Provides poll behavior. */
  private async poll(): Promise<void> {
    if (this.running) return this.running;
    if (!this.enabled || this.visibility() !== "visible") return;
    /** Rejects stale completion after opt-out, backgrounding, or a newer state. */
    const generation = this.generation;
    this.running = this.capability
      .poll({sessionId: this.sessionId, state: this.state, enabled: true})
      .then(({rivals}) => {
        if (generation === this.generation && this.enabled && this.visibility() === "visible") this.onRivals(rivals);
      })
      .finally(() => {
        this.running = undefined;
        if (generation === this.generation && this.enabled && this.visibility() === "visible") {
          this.timer = setTimeout(
            () => void this.poll().catch(() => undefined),
            this.state === "racing" ? REDDIT_RACE_POLL_MS : REDDIT_HUB_POLL_MS,
          );
        }
      });
    return this.running;
  }
}
