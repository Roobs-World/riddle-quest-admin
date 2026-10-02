import type {ListFacebookContextBoardResponse, ListFacebookTournamentResponse, RaceLocale} from "@qwordly/core/race";
import type {ContextBoardCapability, TournamentCapability} from "../../platform/types";
import type {RacePlayClock} from "./RacePlay";
import type {RaceStage} from "./RaceSession.types";

/** Optional standings are presentation caches, independent of competitive authority. */
export type RaceProviderViewState = Readonly<{
  /** Current tournament snapshot for this player lifetime. */ tournament: ListFacebookTournamentResponse | null;
  /** Current context snapshot for this player lifetime. */ contextBoard: ListFacebookContextBoardResponse | null;
  /** Only the owned tournament delivery may display loading. */ tournamentLoading: boolean;
  /** Only the owned context delivery may display loading. */ contextBoardLoading: boolean;
  /** A failed provider read may be retried without repeating a race mutation. */ failed: boolean;
}>;
/** Adapters replaced together when account, language or entry ownership changes. */
type ViewEntry = Readonly<{
  /** Language of every request in this lifetime. */ locale: RaceLocale;
  /** Target-specific tournament projection. */ tournaments?: TournamentCapability;
  /** Target-specific context projection. */ contextBoard?: ContextBoardCapability;
}>;
/** Owned provider delivery timer; identity distinguishes late replies from newer reads. */
type ViewRequest = {
  /** Cancels the owned delivery deadline. */ timer: number;
};
/** Provider screen scopes a retry to the destination of its original completion. */
type RecordKind = "tournaments" | "inbox";
/** Delivery guard persists after success; only pending writes retain a timer. */
type RecordDelivery = {
  /** Provider destination determines context-switch cleanup. */ kind: RecordKind;
  /** Active completion deadline, absent after terminal delivery. */ timer: number | null;
};
/** Owns optional provider reads through navigation, delivery expiry and account replacement. */
export class RaceProviderViews {
  /** Observable caches and loading state remain immutable between notifications. */
  private state: RaceProviderViewState = this.empty();
  /** Rendering adapters subscribe to whole transitions. */
  private listeners = new Set<() => void>();
  /** Current target adapters and locale, absent after disposal. */
  private entry: ViewEntry | null = null;
  /** Reentrant account replacement or disposal supersedes the outer requested entry. */
  private generation = 0;
  /** Actual Race Session screen, including screens without provider views. */
  private stage: RaceStage | null = null;
  /** At most one view read belongs to the selected screen. */
  private request: ViewRequest | null = null;
  /** Recording guards belong to an exact adapter lifetime and delivery, never just a reused run ID. */
  private recordings = new Map<string, RecordDelivery>();
  /** Rejected completions await an explicit visit to their corresponding view. */
  private failedRecordings = new Map<string, {
    /** Original view destination. */ kind: RecordKind;
    /** Canonical completed run. */ runId: string;
  }>();
  /** A confirmed context switch invalidates old context write callbacks and retries. */
  private contextOwner = {};
  /** Browser or deterministic timer adapter. */
  private clock: Pick<RacePlayClock, "schedule" | "cancel">;
  /** Reports existing translated error keys only for the owned request. */
  private reportError: (error: string | null) => void;
  /** Accepts platform and timer seams without creating provider dependencies. */
  constructor(options: {
    /** Session-owned presentation error callback. */ reportError: (error: string | null) => void;
    /** Deterministic delivery timer used by public-interface tests. */ clock?: Pick<RacePlayClock, "schedule" | "cancel">;
  }) {
    this.reportError = options.reportError;
    this.clock = options.clock ?? {schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: timer => window.clearTimeout(timer)};
  }
  /** Fresh player-owned cache state. */
  private empty(): RaceProviderViewState {
    return {tournament: null, contextBoard: null, tournamentLoading: false, contextBoardLoading: false, failed: false};
  }
  /** Stable observable snapshot consumed by React and tests. */
  getSnapshot = (): RaceProviderViewState => this.state;
  /** Subscribes only to complete cache transitions. */
  subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => this.listeners.delete(listener);};
  /** Publishes loading, cache and failure state atomically. */
  private update(patch: Partial<RaceProviderViewState>): void {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }
  /** Invalidates a pending read before clearing its timer or loading indicator. */
  private cancel(): void {
    if (this.request) this.clock.cancel(this.request.timer);
    this.request = null;
  }
  /** Replaces all cache ownership before any new delivery can be issued. */
  enter = (entry: ViewEntry): void => {
    /** The cleanup call owns one generation unless its notification supersedes this entry. */
    const generation = this.generation + 1;
    this.dispose();
    if (this.generation === generation) this.entry = entry;
  };
  /** Disposes timers and invalidates late replies without touching competitive state. */
  dispose = (): void => {
    this.generation++;
    this.cancel(); this.entry = null; this.stage = null;
    for (const receipt of this.recordings.values()) this.cancelRecording(receipt);
    this.recordings.clear(); this.failedRecordings.clear(); this.contextOwner = {};
    this.update(this.empty());
  };
  /** Cancels only the pending delivery budget while retaining its duplicate guard. */
  private cancelRecording(receipt: RecordDelivery): void {
    if (receipt.timer !== null) this.clock.cancel(receipt.timer);
    receipt.timer = null;
  }
  /** Delivers an already-confirmed run independently to each optional projection adapter. */
  record = (runId: string): void => {
    /** Record effects use the captured account/locale adapters even if React props change. */
    const entry = this.entry;
    if (!entry) return;
    for (const kind of ["tournaments", "inbox"] as const) this.deliverRecord(kind, runId, entry);
  };
  /** Retries only the originally owned projection and refreshes reads that predate its successful write. */
  private deliverRecord(kind: RecordKind, runId: string, entry: ViewEntry): void {
    if (this.entry !== entry) return;
    /** Optional target adapter owns the provider destination. */
    const adapter = kind === "tournaments" ? entry.tournaments : entry.contextBoard;
    /** Same run contributes once per destination and exact account lifetime. */
    const key = `${kind}:${runId}`;
    if (!adapter || this.recordings.has(key)) return;
    /** Context changes must not redirect a failed write to a different provider room. */
    const contextOwner = this.contextOwner;
    /** Late completions cannot affect a replacement delivery with the same identifier. */
    const receipt: RecordDelivery = {kind, timer: null};
    this.recordings.set(key, receipt); this.failedRecordings.delete(key);
    /** Both account and provider-context ownership survive asynchronous callbacks. */
    const owned = () => this.entry === entry && this.recordings.get(key) === receipt &&
      (kind !== "inbox" || this.contextOwner === contextOwner);
    /** Rejection permits explicit view recovery without repeating race settlement. */
    const failed = () => {
      if (!owned()) return;
      this.cancelRecording(receipt);
      this.recordings.delete(key); this.failedRecordings.set(key, {kind, runId});
    };
    /** An earlier read cannot overwrite standings after the write becomes visible. */
    const completed = () => {
      if (!owned()) return;
      this.cancelRecording(receipt);
      if (this.stage === kind) this.cancel();
      this.update(kind === "tournaments" ? {tournament: null} : {contextBoard: null});
      if (owned() && this.stage === kind) this.refresh(kind);
    };
    receipt.timer = this.clock.schedule(failed, 30000);
    if (!owned()) return;
    try {
      void adapter.record(runId, entry.locale).then(completed, failed).catch(() => {
        // Presentation notification failure must not repeat a successful provider write.
      });
    } catch {failed();}
  }
  /** A confirmed provider context change invalidates its old standings and any owned read. */
  contextChanged = (): void => {
    if (!this.entry) return;
    this.contextOwner = {};
    for (const receipt of this.recordings.values()) if (receipt.kind === "inbox") this.cancelRecording(receipt);
    for (const [key, record] of this.failedRecordings) if (record.kind === "inbox") this.failedRecordings.delete(key);
    if (this.stage === "inbox") this.cancel();
    this.update({contextBoard: null, contextBoardLoading: false});
    if (this.stage === "inbox") this.refresh("inbox");
  };
  /** Follows the actual session screen synchronously, cancelling reads on every screen change. */
  selectStage = (stage: RaceStage): void => {
    if (!this.entry || stage === this.stage) return;
    this.cancel(); this.stage = stage;
    this.update({tournamentLoading: false, contextBoardLoading: false, failed: false});
    this.refresh(stage);
  };
  /** Refreshes the visible view once; duplicate clicks cannot create overlapping deliveries. */
  refresh = (stage: RaceStage): void => {
    if (!this.entry || this.stage !== stage || this.request) return;
    /** Capture adapters and locale for this exact lifetime before issuing the request. */
    const entry = this.entry;
    if (!(stage === "tournaments" && entry.tournaments || stage === "inbox" && entry.contextBoard)) return;
    for (const record of [...this.failedRecordings.values()]) {
      if (record.kind === stage) this.deliverRecord(record.kind, record.runId, entry);
    }
    if (this.entry !== entry || this.stage !== stage || this.request) return;
    if (this.state.failed) this.reportError(null);
    if (this.entry !== entry || this.stage !== stage || this.request) return;
    /** Unique request ownership is separate from the adapter/account lifetime. */
    const request: ViewRequest = {timer: 0};
    this.request = request;
    /** Only this delivery can release loading or report failure. */
    const finish = (failed: boolean, patch: Partial<RaceProviderViewState> = {}): boolean => {
      if (this.request !== request) return false;
      this.cancel();
      this.update({...patch, tournamentLoading: false, contextBoardLoading: false, failed});
      if (failed && this.entry === entry && this.stage === stage && !this.request) this.reportError("RaceTo10.ERROR_GENERIC");
      return true;
    };
    request.timer = this.clock.schedule(() => finish(true), 30000);
    this.update({tournamentLoading: stage === "tournaments", contextBoardLoading: stage === "inbox", failed: false});
    if (this.request !== request) return;
    // The native call starts synchronously so provider behavior and thrown errors stay observable.
    try {
      if (stage === "tournaments") {
        void entry.tournaments!.list(entry.locale).then(tournament => {
          finish(tournament.locale !== entry.locale, tournament.locale === entry.locale ? {tournament} : {});
        }).catch(() => finish(true));
      } else {
        void entry.contextBoard!.list(entry.locale).then(contextBoard => {
          finish(contextBoard.locale !== entry.locale, contextBoard.locale === entry.locale ? {contextBoard} : {});
        }).catch(() => finish(true));
      }
    } catch {finish(true);}
  };
}
