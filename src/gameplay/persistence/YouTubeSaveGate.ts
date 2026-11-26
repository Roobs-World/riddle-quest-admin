import {serializeYouTubeSave} from "./localSave";
import type {YouTubeSaveV1, YouTubeSdkPort} from "../local/types";
/** Signals that an exact staged revision remains queued for retry. */
export class YouTubeSaveBlockedError extends Error {
  /** Creates a you tube save blocked error instance. */
  constructor() {
    super("youtube-save-retry-required");
    this.name = "YouTubeSaveBlockedError";
  }
}
/**
 * A one-item durable write gate. Material mutations cannot pass an uncertain
 * Cloud Save response; retry always resends the exact same serialized revision.
 */
export class YouTubeSaveGate {
  /** Stores sdk. */
  private readonly sdk: Pick<YouTubeSdkPort, "saveData">;
  /** Stores pending. */
  private pending: {
    /** Stores revision. */
    revision: number;
    /** Stores serialized. */
    serialized: string;
  } | null = null;
  /** Stores in flight. */
  private inFlight: Promise<void> | null = null;
  /** Stores failed. */
  private failed = false;
  /** Creates a you tube save gate instance. */
  constructor(sdk: Pick<YouTubeSdkPort, "saveData">) {
    this.sdk = sdk;
  }
  /** Gets blocked. */
  get blocked(): boolean {
    return this.pending !== null && this.failed;
  }
  /** Gets writing. */
  get writing(): boolean {
    return this.inFlight !== null;
  }
  /** Gets pending revision. */
  get pendingRevision(): number | null {
    return this.pending?.revision ?? null;
  }
  /** Provides commit behavior. */
  async commit(save: YouTubeSaveV1): Promise<void> {
    this.stage(save);
    await this.commitStaged();
  }
  /** Serializes and reserves exact bytes before an authority publishes a transition. */
  stage(save: YouTubeSaveV1): void {
    if (this.pending) throw new YouTubeSaveBlockedError();
    /** Serializes d. */
    const serialized = serializeYouTubeSave(save);
    this.pending = {revision: save.revision, serialized};
    this.failed = false;
  }
  /** Writes bytes previously staged by the authority. */
  async commitStaged(): Promise<void> {
    if (!this.pending) throw new Error("youtube-save-not-staged");
    await this.writePending();
  }
  /** Provides retry behavior. */
  async retry(): Promise<void> {
    if (!this.pending) return;
    this.failed = false;
    await this.writePending();
  }
  /** Best-effort exit save. It intentionally retains a failed exact payload. */
  flush(): void {
    if (!this.pending || this.inFlight) return;
    void this.writePending().catch(() => undefined);
  }
  /** Provides write pending behavior. */
  private async writePending(): Promise<void> {
    if (!this.pending) return;
    if (this.inFlight) return this.inFlight;
    /** Provides exact pending behavior. */
    const exactPending = this.pending;
    // Normalize synchronous SDK failures into the same exact-payload retry path
    // as rejected promises; otherwise a provider throw could wedge the gate.
    this.inFlight = Promise.resolve()
      .then(() => this.sdk.saveData(exactPending.serialized))
      .then(() => {
        if (this.pending === exactPending) {
          this.pending = null;
          this.failed = false;
        }
      })
      .catch((error: unknown) => {
        if (this.pending === exactPending) this.failed = true;
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }
}
