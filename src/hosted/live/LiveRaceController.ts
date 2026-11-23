import {
  JoinLiveRaceSchema, ListRaceCategoriesResponseSchema, LiveRaceChallengeSchema, LiveRaceViewSchema,
  type JoinLiveRace, type ListRaceCategoriesResponse, type LiveRaceCapability,
  type LiveRaceChallenge, type LiveRaceView, type RaceCategoryId, type RaceLocale, type UpdateLiveRace,
} from "../../core/race";
import {livePresentationKey} from "./livePresentation";
import {createRequestId} from "../play/requestIds";
import {createLiveRaceDraft, editLiveRaceDraft, reconcileLiveRaceDraft, rejectLiveRaceDraft, type LiveRaceDraft} from "../race/logic/liveRaceDraft";
import {liveRaceCommandRejected, liveRaceDeliveryDeadline, LIVE_RACE_JOIN_DEADLINE_MS} from "../race/logic/liveRaceDeliveryDeadline";
import {liveRacePollInterval} from "../race/logic/liveRacePolling";
import {createLiveRaceRetirement} from "../race/logic/liveRaceRetirement";
import {createLiveRaceDraftStorage} from "../race/logic/liveRaceDraftStorage";

/** Device-private storage; only owner-bound journey hints and unsent input are persisted. */
export type LiveRaceStorage = {
  /** Reads one optional private checkpoint. */ getItem(key: string): Promise<string | null>;
  /** Writes one private checkpoint. */ setItem(key: string, value: string): Promise<void>;
  /** Removes one private checkpoint. */ removeItem(key: string): Promise<void>;
};
/** One native-independent live multiplayer presentation. */
export type LiveRaceState = Readonly<{
  /** Native view selects its lobby, match or terminal panel from this state. */ view: LiveRaceView | null;
  /** Verified locale-specific server catalog. */ categories: ListRaceCategoriesResponse["categories"];
  /** Current category choice before entering a seat. */ selected: RaceCategoryId;
  /** Server-validated incoming invitations. */ invitations: LiveRaceChallenge[];
  /** Current local answer cells. */ draft: LiveRaceDraft;
  /** Server-clock estimate anchored to monotonic device time. */ now: number;
  /** Local join recovery has not yet established whether a seat is already owned. */ recovering: boolean;
  /** Catalog or invitation refresh. */ loading: boolean;
  /** Join, command or retirement awaits confirmation. */ busy: boolean;
  /** One retryable operation failed. */ error: boolean;
  /** Explicit quit requires confirmation while racing. */ quitConfirmation: boolean;
  /** Definitive rejection must reconcile before another mutation. */ requiresRefresh: boolean;
  /** A confirmed retirement has finished. */ closed: boolean;
}>;
/** Shared controller input; native and browser targets supply only transport and lifecycle adapters. */
export type LiveRaceControllerOptions = {
  /** Exact authenticated account lifetime. */ ownerId: string;
  /** Current content language. */ locale: RaceLocale;
  /** Strict authenticated authoritative transport. */ transport: LiveRaceCapability;
  /** Locale-bound catalog loader. */ categories: (locale: RaceLocale) => Promise<ListRaceCategoriesResponse>;
  /** Private local recovery, never economy or scoring authority. */ storage?: LiveRaceStorage;
  /** Incoming invitation, previewed before acceptance. */ challengeId?: string;
  /** Native completion refresh callback. */ onCompleted?: (view: LiveRaceView) => void;
  /** Monotonic adapter for deterministic clocks. */ clock?: () => number;
  /** Presentation cadence, independent of precise polling and command admission. */ clockPresentationIntervalMs?: number;
};

/** Owns one account's live lobby, idempotent command delivery, input and retirement. */
export class LiveRaceController {
  /** Immutable presentation exposed to the native subscriber. */
  private state: LiveRaceState = {view: null, categories: [], selected: "mixed", invitations: [], draft: createLiveRaceDraft(null),
    now: 0, recovering: true, loading: true, busy: false, error: false, quitConfirmation: false, requiresRefresh: false, closed: false};
  /** Observers notified only when presentation facts change. */
  private readonly listeners = new Set<() => void>();
  /** Monotonic time source, independent of wall-clock adjustments. */
  private readonly clock: () => number;
  /** Cancels local delivery waits without cancelling accepted server mutations. */
  private abort = new AbortController();
  /** Prevents a disposed journey from publishing late receipts. */
  private active = true;
  /** Generation that rejects storage reads from a retired mount. */
  private lifecycle = 0;
  /** Ownership of the latest catalog and invitation refresh. */
  private lobbyRevision = 0;
  /** Foreground state controlling local timers and polling. */
  private visible = true;
  /** Original immutable selectors reused by retries and process recovery. */
  private join: JoinLiveRace | null = null;
  /** One exact idempotent player command awaiting confirmation. */
  private pending: UpdateLiveRace | null = null;
  /** Submitted cells retained separately from newer unsent input. */
  private pendingDraft: LiveRaceDraft | null = null;
  /** Latest transport owner, so superseded polls cannot replace commands. */
  private delivery: object | null = null;
  /** Allows a player command to supersede an outstanding read. */
  private deliveryPoll = false;
  /** Latest accepted server time and its monotonic receipt timestamp. */
  private anchor = {at: 0, server: 0};
  /** Monotonic deadline for the next permitted observation. */
  private nextPoll = 0;
  /** Consecutive transport failures controlling bounded reconnect backoff. */
  private failures = 0;
  /** Terminal ticket whose profile refresh was already delivered. */
  private completedTicket: string | null = null;
  /** Bounded cleanup bound to this journey's original join intent. */
  private retire: ReturnType<typeof createLiveRaceRetirement> | null = null;
  /** Serializes optional storage writes and terminal cleanup. */
  private writes: Promise<void> = Promise.resolve();
  /** Account-scoped key for the exact original join. */
  private readonly key: string;
  /** Separate account-scoped key for unsent presentation cells. */
  private readonly draftKey: string;
  /** Hydrated private bytes consumed by the shared synchronous draft adapter. */
  private cachedDraft: string | null | undefined;
  /** Shared checkpoint and receipt-proof policy over native storage. */
  private readonly draftStorage: ReturnType<typeof createLiveRaceDraftStorage>;

  /** Authenticated account lifetime and injected host ports. */
  private readonly options: LiveRaceControllerOptions;
  /** Binds one account's transport, monotonic clock and private persistence. */
  constructor(options: LiveRaceControllerOptions) {
    this.options = options;
    this.clock = options.clock ?? (() => performance.now());
    this.key = `riddle-quest:live-lobby:${encodeURIComponent(options.ownerId)}`;
    this.draftKey = `${this.key}:draft`;
    this.draftStorage = createLiveRaceDraftStorage(options.ownerId, {
      read: () => this.cachedDraft,
      write: raw => {this.cachedDraft = raw; void this.persist(this.draftKey, raw); return true;},
      remove: () => {this.cachedDraft = null; void this.persist(this.draftKey, null); return true;},
    });
  }
  /** Stable subscription for useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => this.listeners.delete(listener);};
  /** Immutable current presentation. */
  readonly getSnapshot = (): LiveRaceState => this.state;
  /** An admitted join stays owned through timeouts until retirement or an authoritative terminal result. */
  requiresRetirement(): boolean {
    return !this.state.closed && (this.state.recovering || (this.join !== null && this.state.view?.phase !== "result" && this.state.view?.phase !== "cancelled"));
  }
  /** Publishes changed presentation fields while suppressing identical snapshots. */
  private patch(update: Partial<LiveRaceState>): void {
    if (!this.active) return;
    /** Candidate snapshot whose unchanged fields need no render. */
    const next = {...this.state, ...update};
    /** Existing field identities used to suppress equivalent snapshots. */
    const currentValues = Object.values(this.state);
    if (Object.values(next).every((value, index) => Object.is(value, currentValues[index]))) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  /** Serializes optional private writes without rejecting authoritative play. */
  private persist(key: string, value: string | null): Promise<void> {
    /** Optional device-private persistence port. */
    const storage = this.options.storage;
    this.writes = this.writes.catch(() => undefined).then(async () => {
      if (!storage) return;
      try {if (value === null) await storage.removeItem(key); else await storage.setItem(key, value);} catch { /* Optional presentation storage cannot reject authority. */ }
    });
    return this.writes;
  }
  /** Loads the catalog, previews incoming invitations and recovers the exact acknowledged seat. */
  async start(): Promise<void> {
    /** Mount generation that owns this asynchronous startup. */
    const generation = ++this.lifecycle;
    this.active = true;
    this.patch({recovering: true});
    if (this.abort.signal.aborted) this.abort = new AbortController();
    try {this.cachedDraft = await this.options.storage?.getItem(this.draftKey);} catch {this.cachedDraft = undefined;}
    if (!this.active || generation !== this.lifecycle) return;
    /** Read-only lobby load that runs alongside recovery. */
    const catalog = this.refreshLobby();
    try {
      /** Untrusted serialized join hint from device storage. */
      const raw = await this.options.storage?.getItem(this.key);
      if (!this.active || generation !== this.lifecycle) return;
      if (raw && raw.length < 2048) {
        /** Unknown persisted bytes before retention and selector validation. */
        const envelope: unknown = JSON.parse(raw);
        /** Strict join selectors whose owner and lifetime still require matching. */
        const saved = envelope && typeof envelope === "object" && "savedAtMs" in envelope && typeof envelope.savedAtMs === "number" &&
          envelope.savedAtMs <= Date.now() && Date.now() - envelope.savedAtMs <= 30 * 60_000 && "join" in envelope
          ? JoinLiveRaceSchema.safeParse(envelope.join) : null;
        if (saved?.success && saved.data.expectedOwnerId === this.options.ownerId && saved.data.locale === this.options.locale && this.active &&
          (!this.options.challengeId || saved.data.challengeId === this.options.challengeId)) {
          this.join = saved.data;
          this.retire = createLiveRaceRetirement(this.options.transport, createRequestId("native-live-leave"), this.join.requestId, this.options.ownerId);
          this.patch({recovering: false});
          await this.deliver();
        }
      }
    } catch { /* Invalid or unavailable hints never create authority. */ }
    if (this.active && generation === this.lifecycle) this.patch({recovering: false});
    await catalog;
  }
  /** Refreshes only read-only entry data; it never occupies an incoming invitation. */
  async refreshLobby(): Promise<void> {
    /** Exact refresh allowed to publish its asynchronous response. */
    const revision = ++this.lobbyRevision;
    this.patch({loading: true, error: false});
    try {
      /** Independent read-only server responses for category selection and invitations. */
      const [catalog, invitations] = await Promise.all([
        liveRaceDeliveryDeadline(this.options.categories(this.options.locale), false, undefined, this.abort.signal),
        this.options.challengeId && this.options.transport.challenge
          ? liveRaceDeliveryDeadline(this.options.transport.challenge({challengeId: this.options.challengeId}), false, undefined, this.abort.signal).then(value => [value])
          : this.options.transport.inbox ? liveRaceDeliveryDeadline(this.options.transport.inbox(), false, undefined, this.abort.signal) : Promise.resolve([]),
      ]);
      if (!this.active || revision !== this.lobbyRevision) return;
      /** Catalog accepted by the shared runtime schema. */
      const categories = ListRaceCategoriesResponseSchema.parse(catalog).categories;
      /** Strict invitation previews that have not occupied a seat. */
      const parsedInvitations = invitations.map(value => LiveRaceChallengeSchema.parse(value));
      this.patch({categories, invitations: parsedInvitations, loading: false,
        selected: categories.some(item => item.categoryId === this.state.selected) ? this.state.selected : categories[0]?.categoryId ?? "mixed"});
    } catch {if (this.active && revision === this.lobbyRevision) this.patch({loading: false, error: true});}
  }
  /** Selects one authoritative catalog category. */
  select(categoryId: RaceCategoryId): void {
    if (!this.state.busy && this.state.categories.some(item => item.categoryId === categoryId)) this.patch({selected: categoryId});
  }
  /** Public matchmaking and private reservations use the same stable join identity. */
  async play(createChallenge = false, invitation?: LiveRaceChallenge): Promise<void> {
    if (this.state.busy || this.join || this.state.loading || !this.state.categories.length) return;
    if (invitation && !["available", "own", "accepted"].includes(invitation.status)) return;
    this.join = {locale: invitation?.locale ?? this.options.locale, categoryId: invitation?.categoryId ?? this.state.selected,
      requestId: createRequestId("native-live-join"), retirementAware: true, expectedOwnerId: this.options.ownerId,
      ...(invitation ? {challengeId: invitation.challengeId} : createChallenge ? {createChallenge: true} : {waitForPlayer: true})};
    this.retire = createLiveRaceRetirement(this.options.transport, createRequestId("native-live-leave"), this.join.requestId, this.options.ownerId);
    this.patch({busy: true, error: false});
    await this.persistJoin(this.join);
    await this.deliver();
  }
  /** Stores unchanged join selectors so recovery preserves the server request binding. */
  private persistJoin(join: JoinLiveRace): Promise<void> {
    return this.persist(this.key, JSON.stringify({savedAtMs: Date.now(), join}));
  }
  /** Accepts an owned projection while retaining local input and exact clock anchors. */
  private apply(view: LiveRaceView): void {
    /** Last published canonical projection used to bind drafts. */
    const previous = this.state.view;
    if (previous && previous.ticketId !== view.ticketId) throw new Error("live-ticket-mismatch");
    if (previous && view.serverNowMs < this.anchor.server) return;
    /** Local cells reconciled against the newly accepted question and hint locks. */
    let draft = reconcileLiveRaceDraft(this.state.draft, previous, view);
    if (this.pending?.action === "guess" && this.pendingDraft && this.state.draft.revision === this.pendingDraft.revision) {
      draft = createLiveRaceDraft(view.run?.currentRiddle ?? null, draft.revision);
    }
    this.anchor = {at: this.clock(), server: view.serverNowMs};
    /** Whether the response changes gameplay presentation beyond clock anchors. */
    const changed = !previous || livePresentationKey(previous) !== livePresentationKey(view);
    if (changed) this.patch({view, draft, now: view.serverNowMs, error: false, requiresRefresh: false,
      quitConfirmation: ["result", "cancelled"].includes(view.phase) ? false : this.state.quitConfirmation});
    else this.patch({draft, error: false, requiresRefresh: false});
    if (view.phase === "result" || view.phase === "cancelled") {
      void this.persist(this.key, null); this.draftStorage.clear();
      if (view.phase === "result" && this.completedTicket !== view.ticketId) {
        this.completedTicket = view.ticketId;
        try {this.options.onCompleted?.(view);} catch { /* Host profile refresh cannot alter a result. */ }
      }
    } else if (this.join) {
      // The server intent binds this original selector set to its exact ticket.
      void this.persistJoin(this.join);
    }
  }
  /** Persists only unsent cells, with a receipt locator for independent later input. */
  private saveDraft(): void {
    /** Canonical question that owns the unsent checkpoint. */
    const view = this.state.view, draft = this.state.draft;
    if (!view) return;
    /** Current authoritative attempt identity for receipt correlation. */
    const riddle = view.run?.currentRiddle;
    if (this.pending && (!this.pendingDraft || draft.revision <= this.pendingDraft.revision)) return;
    /** Answer-free locator proving an earlier accepted guess without replaying it. */
    const guessReceipt = this.pending?.action === "guess" && riddle ? {
      ticketId: view.ticketId, requestId: this.pending.requestId, riddleId: riddle.riddleId,
      position: riddle.position, guessesUsedBefore: riddle.guessesUsed,
    } : undefined;
    this.draftStorage.save(view, draft, guessReceipt);
  }
  /** Restores proven cells only while their question and local revision still match. */
  private async restoreDraft(view: LiveRaceView): Promise<void> {
    /** Local edit intent captured before optional recovery awaits proof. */
    const revision = this.state.draft.revision;
    /** Checkpoint accepted by the shared binding and immutable receipt policy. */
    const draft = await this.draftStorage.restoreWithReceipt(view, this.options.transport.confirmGuessReceipt?.bind(this.options.transport), this.abort.signal);
    if (draft && this.active && this.state.view === view && this.state.draft.revision === revision) this.patch({draft});
  }
  /** Owns one bounded join, command or poll and its eventual authority receipt. */
  private async deliver(poll = false): Promise<void> {
    if (!this.active || this.state.closed || this.delivery || !this.join) return;
    /** Canonical seat captured when this transport delivery is admitted. */
    const view = this.state.view;
    if (poll && (!view || ["result", "cancelled"].includes(view.phase))) return;
    /** Pending immutable mutation or a fresh read-only poll. */
    const command = this.pending ?? (view ? {ticketId: view.ticketId, action: "poll", requestId: createRequestId("native-live-poll")} satisfies UpdateLiveRace : null);
    /** Receipt identity that revokes superseded or disposed callbacks. */
    const owner = {};
    /** Read-only deliveries may yield to an interactive command. */
    const observing = Boolean(view && !this.pending);
    this.delivery = owner;
    this.deliveryPoll = observing;
    this.patch({busy: !observing, error: false});
    /** Validates and publishes only the latest owned authority response. */
    const accept = (raw: unknown) => {
      if (!this.active || this.state.closed || this.delivery !== owner) return;
      /** Projection parsed through the strict shared live schema. */
      const next = LiveRaceViewSchema.parse(raw);
      this.apply(next);
      if (this.pending === command) {this.pending = null; this.pendingDraft = null;}
      if (!view?.run?.currentRiddle && next.run?.currentRiddle) void this.restoreDraft(next).then(() => this.saveDraft());
      else this.saveDraft();
      this.failures = 0;
    };
    try {
      /** Authenticated request selected without accepting client scores or clocks. */
      const response = command ? this.options.transport.update(command) : this.options.transport.join(this.join);
      accept(await liveRaceDeliveryDeadline(response, observing, accept, this.abort.signal, view ? undefined : LIVE_RACE_JOIN_DEADLINE_MS));
    } catch (error) {
      if (this.active && this.delivery === owner) {
        if (command && liveRaceCommandRejected(error)) {
          if (this.pendingDraft) this.patch({draft: rejectLiveRaceDraft(this.state.draft, this.pendingDraft)});
          this.pending = null; this.pendingDraft = null; this.patch({requiresRefresh: true});
        }
        this.failures++;
        this.patch({error: true});
      }
    } finally {
      if (this.delivery === owner) {
        this.delivery = null;
        this.patch({busy: false});
        this.nextPoll = this.clock() + (this.failures ? Math.min(15_000, 1000 * 2 ** Math.min(this.failures, 4)) :
          liveRacePollInterval(this.state.view, this.visible));
      }
    }
  }
  /** Estimates exact server time independently of presentation cadence. */
  private serverNow(): number {return this.anchor.server + Math.max(0, this.clock() - this.anchor.at);}
  /** Native foreground events share the same server-time and reconnect policy. */
  setVisible(visible: boolean): void {this.visible = visible; if (visible) {this.nextPoll = 0; this.tick();}}
  /** A host timer only drives this owned policy; it cannot mutate scores or rewards. */
  readonly tick = (): void => {
    if (!this.active || !this.visible) return;
    if (this.state.view && ["result", "cancelled"].includes(this.state.view.phase)) return;
    if (this.state.view) {
      /** Exact monotonic server-time estimate before presentation throttling. */
      const now = this.serverNow();
      /** Presentation interval, separate from transport and command timing. */
      const interval = Math.max(100, this.options.clockPresentationIntervalMs ?? 100);
      /** Fixed scored start used to align countdown and elapsed display intervals. */
      const start = this.state.view.startsAtMs ?? 0;
      if (Math.floor((now - start) / interval) !== Math.floor((this.state.now - start) / interval)) this.patch({now});
    }
    if (this.join && this.clock() >= this.nextPoll) void this.deliver(true);
  };
  /** Retry preserves the original join or command's idempotency key. */
  readonly retry = (): void => {if (this.join) void this.deliver(); else void this.refreshLobby();};
  /** Edits only the current draft; hint locks come from authoritative state. */
  edit(kind: "text" | "backspace" | "slot", value: string | number): void {
    /** Authoritative prompt whose hint locks constrain local editing. */
    const riddle = this.state.view?.run?.currentRiddle;
    if (!riddle || this.state.view?.phase !== "racing" || this.state.quitConfirmation || this.state.closed) return;
    this.patch({draft: editLiveRaceDraft(riddle, this.state.draft, kind, value)});
    this.saveDraft();
  }
  /** Commands carry only question identity and input, never a score, reward or clock. */
  action(action: "guess" | "hint" | "skip"): void {
    /** Current owned seat and question used to admit a mutation. */
    const view = this.state.view, riddle = view?.run?.currentRiddle;
    if (!view || !riddle || view.phase !== "racing" || this.pending || this.delivery && !this.deliveryPoll || this.state.quitConfirmation || this.state.requiresRefresh ||
      this.serverNow() < (view.actionAvailableAtMs ?? 0)) return;
    if (action === "guess" && this.state.draft.letters.some(letter => !letter)) return;
    if (action === "hint" && !riddle.hintAvailable) return;
    if (this.deliveryPoll) this.delivery = null;
    this.pending = {ticketId: view.ticketId, action, requestId: createRequestId(`native-live-${action}`), riddleId: riddle.riddleId,
      ...(action === "guess" ? {guess: this.state.draft.letters.join("")} : {})};
    this.pendingDraft = action === "guess" ? this.state.draft : null;
    if (action === "guess") {
      this.patch({draft: createLiveRaceDraft(riddle, this.state.draft.revision)});
      this.draftStorage.clear();
      void this.writes.then(() => this.deliver());
    }
    else void this.deliver();
  }
  /** Returns terminal matches to category selection without creating a replacement seat. */
  returnToLobby(): void {
    if (!this.state.view || !["result", "cancelled"].includes(this.state.view.phase)) return;
    this.join = null; this.pending = null; this.pendingDraft = null; this.retire = null;
    this.patch({view: null, draft: createLiveRaceDraft(null), error: false, requiresRefresh: false});
    void this.refreshLobby();
  }
  /** Reserves a new private race for the original human opponent through the authority. */
  async rematch(): Promise<void> {
    /** Completed human match whose opponent the server resolves privately. */
    const view = this.state.view;
    if (!view || view.phase !== "result" || view.opponent?.bot !== false || !this.options.transport.rematch || this.state.busy) return;
    this.join = {locale: view.run?.locale ?? this.options.locale, categoryId: view.run?.categoryId ?? this.state.selected,
      requestId: createRequestId("native-live-rematch"), retirementAware: true, expectedOwnerId: this.options.ownerId, rematchOfTicketId: view.ticketId};
    this.retire = createLiveRaceRetirement(this.options.transport, createRequestId("native-live-leave"), this.join.requestId, this.options.ownerId);
    this.patch({view: null, draft: createLiveRaceDraft(null), busy: true, requiresRefresh: false, error: false});
    await this.persistJoin(this.join); await this.deliver();
  }
  /** Keeps a running race visible until the player explicitly confirms retirement. */
  requestClose(): void {
    if (this.state.recovering) return;
    if (this.state.view?.phase === "racing" || this.state.view?.phase === "countdown") this.patch({quitConfirmation: true});
    else void this.close();
  }
  /** Dismisses quit confirmation without creating a server command. */
  cancelClose(): void {this.patch({quitConfirmation: false});}
  /** Retires the original join, including a request whose receipt is still in flight. */
  async close(): Promise<void> {
    if (this.state.recovering) return;
    this.patch({busy: true, quitConfirmation: false});
    /** Authoritative retirement acknowledgement required before navigation closes. */
    const confirmed = !this.retire || await this.retire(this.state.view, {retry: true});
    if (!confirmed) {this.patch({busy: false, error: true}); return;}
    if (this.join) {await this.persist(this.key, null); this.draftStorage.clear(); await this.writes;}
    this.patch({busy: false, closed: true});
  }
  /** Releases local delivery waits; process/background recovery retains its original server seat. */
  dispose(): void {this.active = false; this.lifecycle++; this.lobbyRevision++; this.abort.abort(); this.delivery = null; this.listeners.clear();}
}
