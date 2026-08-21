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
  /** Stores session id. */
  private readonly sessionId: string;
  /** Stores capability. */
  private readonly capability: PresenceCapability;
  /** Stores on rivals. */
  private readonly onRivals: (rivals: Array<{userId: string; state: PresenceState}>) => void;
  /** Stores visibility. */
  private readonly visibility: () => DocumentVisibilityState;

  /** Creates a reddit polling presence instance. */
  constructor(capability: PresenceCapability, options: {
    sessionId?: string;
    onRivals?: (rivals: Array<{userId: string; state: PresenceState}>) => void;
    visibility?: () => DocumentVisibilityState;
  } = {}) {
    this.capability = capability;
    this.sessionId = options.sessionId ?? crypto.randomUUID().replaceAll("-", "_");
    this.onRivals = options.onRivals ?? (() => undefined);
    this.visibility = options.visibility ?? (() => document.visibilityState);
  }

  /** Sets enabled. */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    this.clearTimer();
    if (!enabled) {
      await this.capability.poll({sessionId: this.sessionId, state: this.state, enabled: false});
      this.onRivals([]);
    } else if (this.visibility() === "visible") await this.poll();
  }

  /** Sets state. */
  async setState(state: Exclude<PresenceState, "offline">): Promise<void> {
    this.state = state;
    if (this.enabled && this.visibility() === "visible") {
      this.clearTimer();
      await this.poll();
    }
  }

  /** Provides visibility changed behavior. */
  async visibilityChanged(): Promise<void> {
    this.clearTimer();
    if (!this.enabled) return;
    if (this.visibility() === "hidden") await this.capability.disconnect(this.sessionId);
    else await this.poll();
  }

  /** Provides stop behavior. */
  async stop(): Promise<void> {
    this.enabled = false;
    this.clearTimer();
    await this.capability.disconnect(this.sessionId);
    this.onRivals([]);
  }

  /** Clears timer. */
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  /** Provides poll behavior. */
  private async poll(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.capability.poll({sessionId: this.sessionId, state: this.state, enabled: true})
      .then(({rivals}) => this.onRivals(rivals))
      .finally(() => {
        this.running = undefined;
        if (this.enabled && this.visibility() === "visible") {
          this.timer = setTimeout(() => void this.poll().catch(() => undefined),
            this.state === "racing" ? REDDIT_RACE_POLL_MS : REDDIT_HUB_POLL_MS);
        }
      });
    return this.running;
  }
}
