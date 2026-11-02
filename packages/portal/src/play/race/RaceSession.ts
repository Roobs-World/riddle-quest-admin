import {RaceOwnedAuthority} from "./RaceOwnedAuthority";
import {parseHostToGameMessage, type GameToHostMessage} from "@qwordly/core/bridge";
import {classifyRaceMatchFailure, raceMatchFailure, type RaceMatchFailure} from "@qwordly/core/race";
import {type RaceOutcome, type RaceAnalyticsEventName, type RaceCategoryId, type RaceInboxItem, type RaceRunView, type SocialReportCategory} from "@qwordly/core/race";
import type {MatchmakingCapability} from "../../platform/types";
import {createRequestId} from "@qwordly/hosted/play/requestIds";
import {RacePlay, type RacePlayClock} from "./RacePlay";
import {raceErrorKey, raceRejectedState, raceMatchErrorKey, bindRaceCommand, applyRaceAuthority, raceAttemptState, type RaceResumeDraft} from "./RaceSessionAuthority";
import type {RaceSessionEffect, RaceSessionEntry, RaceSessionOptions, RaceSessionState, RaceStage} from "./RaceSession.types";
import {browserRaceRecovery, RACE_RECOVERY_TTL_MS, type RaceRecoveryIntent, type RaceRecoveryPersistence} from "./logic/raceRecoveryStorage";
import {clearActiveRace, readActiveRace, saveActiveRace, persistConfirmedRace} from "./logic/activeRaceStorage";
import {isolateRaceRecovery, isolateRaceResume} from "./logic/raceOptionalStorage";
import {nextRaceEntryPollAt, advanceRaceLoadingProgress, estimatedRaceServerNow, scheduledRaceCountdown, RACE_GO_DISPLAY_MS} from "./logic/raceCountdown";
import {RaceDrafts} from "./logic/raceDraftStorage";
import {initialRaceSessionState, updateRaceSessionState, idleRaceDiscovery, resetOwnedRaceState} from "./logic/raceInitialState";
import {editRaceInput, isRaceSlotEditable} from "./logic/raceInput";
import type {RaceOperation} from "./logic/raceOperations";
import {ownsRaceMatchmaking, resolveRaceMatchmaking, findOwnedRaceOpponent, observeRaceMatchResult, parseOwnedRaceMatch, raceMatchDelivery, raceDiscoveryFailure} from "./logic/raceMatchDiscovery";
import {requestedRaceState, assertRequestedRaceRun} from "./logic/raceRequestSelection";
import {existingRaceRunId, isCreatorRaceEntry, selectedRaceChallengeId, raceEntryView, canCancelRaceInvitation} from "./logic/raceEntrySelection";
import {canRetryRaceMatch, failedRaceDiscovery, failedRaceRecovery, retryRaceMatchIntent, restoredRaceFailure, needsRaceCatalog, recoveredRaceCatalog, type RaceMatchIntent} from "./logic/raceDiscoveryRecovery";
import {recordOwnedRaceStart} from "./logic/raceStartDelivery";
import {getAdjustedRaceTime} from "./logic/racePresentation";

/** One observable owner for Race Session transitions and authority reconciliation. */
export class RaceSession {
  /** Current provider adapter supports another opponent search after a fallback race. */
  private lastMatchmaking: MatchmakingCapability | undefined;
  /** Search intent survives transport retries but never account, navigation or preference changes. */
  private matchIntent: RaceMatchIntent | null = null;
  /** Settles and cancels the current discovery wait when its player lifetime ends. */
  private cancelMatchWait: (() => void) | null = null;
  /** Stable snapshot replaced only by a complete state transition. */ private state: RaceSessionState;
  /** Account, language and entry intent belonging to this lifetime. */ private entry: RaceSessionEntry;
  /** Private Race Projection implementation shared by all authority paths. */ private readonly play: RacePlay;
  /** Browser effects and deterministic adapter configuration. */ private readonly options: RaceSessionOptions;
  /** Monotonic time and cancellable loader scheduling. */ private readonly clock: RacePlayClock;
  /** Account-bound hint adapter; never an authorization credential. */ private readonly persistence: NonNullable<RaceSessionOptions["persistence"]>;
  /** Optional local hint storage, separate from authority-owned run state. */ private readonly recovery: RaceRecoveryPersistence;
  /** Unsent presentation input is restored only after canonical question confirmation. */
  private readonly drafts: RaceDrafts;
  /** Exact last observed journal revision protects newer tab selections. */ private recoveryId: string | null = null;
  /** Identity used by transport, retries and cleanup belongs to the confirmed run. */
  private get ownedRunId(): string | undefined {return this.authority.run?.runId ?? this.state.run?.runId;}
  /** Observable listeners. */ private readonly listeners = new Set<() => void>();
  /** Current mounted/entered lifetime. */ private active = false;
  /** Asynchronous discovery and provider effects belong to this generation. */ private generation = 0;
  /** Attribution belongs only to this lifetime and the exact offered recording. */
  private matchOffer: {
    /** Opaque server receipt. */ id: string;
    /** Offered recording. */ challengeId: string;
  } | null = null;
  /** Validates receipt payloads against the command that issued them. */ private command: {
    /** Current operation. */ operation: RaceOperation;
    /** Exact selection supplied to authority, independent of later presentation changes. */ payload: Record<string, unknown>;
    /** Only a fresh start may deliberately replace the shared resume selection. */ selectNewRun: boolean;
    /** Requested owned run. */ runId?: string} | null = null;
  /** Failed preparation confirmation retains its complete selection and original mutation receipt. */
  private startRetry: {
    /** Original category/challenge preferences and preparation flags. */ payload: Record<string, unknown>;
    /** Authority start receipt reused to recover the original run. */ requestId: string;
  } | null = null;
  /** Failed cold resume reads retain their original account-bound run selection. */
  private resumeRetry: string | null = null;
  /** Successor typing survives a rejected guess until an owned resume confirms or supersedes it. */
  private resumeDraft: RaceResumeDraft | null = null;
  /** Canonical run, outcome and receipt lifetime remain separate from mutable presentation. */
  private readonly authority = new RaceOwnedAuthority();
  /** Catalog activity cache belongs only to this session. */ private inboxLoadedAt = -Infinity;
  /** Rivalry carried into a new creator attempt. */ private rivalryId: string | undefined;
  /** Prevents duplicate outcome reconciliation and provider completion effects. */ private outcomeRequested = false;
  /** Confirmed completions already emitted in this session lifetime. */ private readonly notifiedRuns = new Set<string>();
  /** Deferred share only follows the current publication. */ private shareAfterPublish = false;
  /** Failed quit/publication confirmations retain their original run-bound mutation identity. */
  private mutationRetry: {
    /** Authority mutation whose confirmation was rejected. */ operation: "raceAbandon" | "racePublish";
    /** Owned run authorizing this mutation. */ runId: string;
    /** Correlation and server idempotency receipt reused during recovery. */ requestId: string;
    /** Withdrawn quit intent requires a read to resolve uncertain abandonment, never another mutation. */ recoverOnly?: boolean;
  } | null = null;
  /** Beginning of the visible preparation indicator. */ private preparationAt = 0;
  /** Authority payload completion indicator anchor. */ private loadedAt: number | null = null;
  /** Polling is suspended while the browser adapter is hidden. */ private visible = true;
  /** Next bounded discovery retry on the monotonic clock. */ private pollAt = Infinity;
  /** Backoff count for the current invitation lifetime. */ private pollAttempt = 0;
  /** Receipt anchor for authority-owned invitation expiry. */ private entryReceivedAt = 0;
  /** Transient feedback expiry. */ private feedbackUntil = 0;
  /** Transient penalty expiry. */ private penaltyUntil = 0;

  /** Creates state without dispatching bridge commands during React render. */
  constructor(entry: RaceSessionEntry, options: RaceSessionOptions) {
    this.entry = entry;
    this.options = options;
    this.clock = options.clock ?? {now: () => performance.now(), schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: timer => window.clearTimeout(timer)};
    this.persistence = isolateRaceResume(options.persistence ?? {read: readActiveRace, save: saveActiveRace, clear: clearActiveRace});
    this.recovery = isolateRaceRecovery(options.recovery ?? browserRaceRecovery);
    this.drafts = new RaceDrafts(options.draftStorage);
    this.state = initialRaceSessionState(entry, this.clock.now());
    this.play = new RacePlay({postToHost: options.postToHost, clock: this.clock, requestId: options.requestId,
      onDeliveryFailure: (requestId, operation) => this.receive({type: "host:operationResult", requestId,
        payload: {operation, ok: false, error: "RaceTo10.ERROR_GENERIC"}})});
    this.play.subscribe(() => this.update({...this.play.getSnapshot(), allowTypingWhilePending: this.play.typingWhilePending}));
  }
  /** External-store snapshot is stable between notifications. */ getSnapshot = (): RaceSessionState => this.state;
  /** Returns only the privately confirmed completion identity for optional provider catch-up. */
  getConfirmedOutcomeRunId = (): string | null => this.authority.outcome?.runId ?? null;
  /** Subscribes rendering or behavioural tests to complete transitions. */
  subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => this.listeners.delete(listener);};
  /** Applies all related state changes before publishing to observers. */
  private update(patch: Partial<RaceSessionState>): void {
    this.state = updateRaceSessionState(this.state, patch, this.play.requiresRunRefresh);
    if (this.active && this.authority.run) this.drafts.sync(this.entry.ownerId, this.authority.run, this.state,
      this.play.typingWhilePending, () => this.wallNow(), this.captureLifetime(), this.authority.receivedAtMs, this.clock.now());
    for (const listener of this.listeners) listener();
  }
  /** Captures outbound ownership across synchronous observers and optional adapters. */
  private captureLifetime(): () => boolean {
    /** Only the originating authenticated journey may continue this action. */
    const generation = this.generation;
    return () => this.active && generation === this.generation;
  }
  /** Emits only session-owned, validated side effects. */
  private analytics(event: RaceAnalyticsEventName, params: Record<string, string | number | boolean> = {}): void {
    this.emit({kind: "analytics", event, params});
  }
  /** Optional adapters cannot turn committed authority into rollback or block later effects. */
  private emit(effect: RaceSessionEffect): void {
    try {
      /** Asynchronous adapters have the same failure isolation as synchronous ones. */
      const delivery = this.options.effect?.(effect);
      if (delivery) void Promise.resolve(delivery).catch(() => undefined);
    } catch {
      // Competitive state and receipts remain committed; each optional adapter owns its recovery.
    }
  }
  /** Replaces entry ownership and invalidates all receipts before issuing the new entry command. */
  enter = (entry: RaceSessionEntry = this.entry): void => {
    /** Reentrant entry during disposal supersedes this requested entry as well. */
    const generation = this.generation + 1;
    this.dispose();
    if (this.generation !== generation) return;
    this.entry = entry;
    this.active = true;
    /** All entry reads and notifications retain this account lifetime. */
    const current = this.captureLifetime();
    this.rivalryId = undefined;
    this.inboxLoadedAt = -Infinity;
    this.notifiedRuns.clear();
    this.outcomeRequested = false;
    this.shareAfterPublish = false;
    this.loadedAt = null;
    this.pollAt = Infinity;
    this.pollAttempt = 0;
    if (!resetOwnedRaceState(entry, () => this.clock.now(), current, state => this.update(state))) return;
    // Incoming tournament navigation reads only the provider view; retained race hints stay untouched.
    if (entry.tournamentLocale) return;
    if (entry.openInbox) this.send("raceInbox", "game:listRaceInbox", {limit: 20});
    else if (entry.challengeId) this.send("raceEntry", "game:getRaceEntry", {challengeId: entry.challengeId, locale: entry.locale});
    else {
      /** Resume hints belong to the newly entered account. */
      const saved = this.recovery.read(entry.ownerId, entry.locale, this.wallNow());
      if (!current()) return;
      this.recoveryId = saved?.id ?? null;
      /** Confirmed run hints take precedence over earlier transport intentions. */
      const runId = this.persistence.read(entry.ownerId);
      if (!current()) return;
      if (!runId && saved) {
        if (saved.intent.kind === "challenge") {
          this.matchOffer = saved.intent.offerId ? {id: saved.intent.offerId, challengeId: saved.intent.challengeId} : null;
          this.update({stage: "challenge", activeChallengeId: saved.intent.challengeId});
          if (!current()) return;
          this.send("raceEntry", "game:getRaceEntry", {challengeId: saved.intent.challengeId, locale: entry.locale});
          return;
        }
        if (saved.intent.kind === "start") {
          /** Reuse the original server mutation identity after a lost confirmation. */
          const {requestId, ...payload} = saved.intent.request;
          this.update({stage: "countdown", activeChallengeId: saved.intent.request.challengeId});
          if (!current()) return;
          this.preparationAt = this.clock.now();
          this.send("raceStart", "game:startRace", payload, requestId);
          return;
        }
        /** Resolve capabilities from the current authenticated provider lifetime. */
        const adapter = resolveRaceMatchmaking(this.options.getMatchmaking);
        if (!current()) return;
        if (adapter) {
          this.matchIntent = {adapter, request: saved.intent.request, retryAtMs: this.clock.now()};
          if (saved.intent.failure) {
            this.matchFailed(restoredRaceFailure(saved.intent.failure, saved.intent.retryAtMs, this.wallNow()));
            if (current()) this.restoreCatalog();
          } else void this.searchMatch(this.matchIntent);
          return;
        }
        this.clearRecovery();
        if (!current()) return;
      }
      if (runId) this.send("raceResume", "game:resumeRace", {runId, includeEvaluation: true});
      else this.restoreCatalog();
    }
  };
  /** Invalidates late host/provider responses and scheduled projection loaders. */
  dispose = (): void => {
    this.lastMatchmaking = undefined;
    this.authority.reset();
    this.active = false;
    this.drafts.reset();
    /** Cleanup notifications may install a new live journey before this frame returns. */
    const generation = ++this.generation;
    /** Detach the original cancellation before invoking any adapter. */
    const cancelMatchWait = this.cancelMatchWait;
    this.cancelMatchWait = null;
    this.recoveryId = null;
    this.matchOffer = null;
    this.matchIntent = null;
    this.command = null;
    this.mutationRetry = null;
    this.startRetry = null;
    this.resumeRetry = null;
    this.resumeDraft = null;
    this.pollAt = Infinity;
    cancelMatchWait?.();
    if (this.generation !== generation) return;
    this.play?.dispose();
    if (this.generation !== generation) return;
    this.update({findingOpponent: false, matchSearchStatus: "idle", matchFailure: null, matchRetryReady: true});
  };
  /** Correlation and mutation receipts are issued by the private gameplay module. */
  private send(operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>, replayRequestId?: string): void {
    if (!this.active) return;
    payload = bindRaceCommand(payload, this.authority.run);
    /** Reserve pending before notification so observers cannot dispatch a second mutation. */
    const current = this.captureLifetime();
    if (["raceStart", "raceGuess", "raceHint", "raceSkip", "raceAbandon", "raceOutcome"].includes(operation)) this.resumeDraft = null;
    if (operation === "raceResume" && !this.state.run && typeof payload.runId === "string") this.resumeRetry = payload.runId;
    this.command = {operation, selectNewRun: operation === "raceStart" && replayRequestId === undefined, payload: {...payload}, ...(typeof payload.runId === "string" ? {runId: payload.runId} : {})};
    this.update({error: operation === "raceCategories" ? this.state.error : null, pending: operation});
    if (!current()) return;
    if (operation === "raceStart") {
      /** Store only the validated selection and original idempotency identity. */
      replayRequestId = recordOwnedRaceStart(payload, replayRequestId, this.options.requestId ?? createRequestId, current,
        request => this.saveRecovery({kind: "start", request}, replayRequestId !== undefined));
    } else if (operation === "raceEntry" && typeof payload.challengeId === "string") {
      this.saveRecovery({kind: "challenge", challengeId: payload.challengeId,
        ...(this.matchOffer?.challengeId === payload.challengeId ? {offerId: this.matchOffer.id} : {})}, this.recoveryId !== null);
    }
    if (current()) this.play.send(operation, type, payload, replayRequestId);
  }
  /** Wall time is used only for local hint retention, never scoring. */
  private wallNow(): number {return (this.options.wallNow ?? Date.now)();}
  /** Persist minimal selection before transport can confirm synchronously or be interrupted. */
  private saveRecovery(intent: RaceRecoveryIntent, preserveSelection = false): void {
    if (!this.entry.ownerId) return;
    /** Clock and storage observations both retain the originating journal owner. */
    const current = this.captureLifetime();
    /** Local retention clock is separate from authoritative race timing. */
    const now = this.wallNow();
    if (!current()) return;
    if (preserveSelection) {
      /** Another tab's revision belongs to its newer selection, not this provider receipt. */
      const selected = this.recovery.read(this.entry.ownerId, this.entry.locale, now);
      if (!current() || selected?.id !== this.recoveryId) return;
    }
    this.recoveryId = createRequestId("raceRecovery");
    this.recovery.save({version: 1, id: this.recoveryId, ownerId: this.entry.ownerId, locale: this.entry.locale,
      savedAtMs: now, expiresAtMs: now + RACE_RECOVERY_TTL_MS, intent});
  }
  /** Deliberate replacement clears only the failed cold resume selection, never another tab's newer run. */
  private clearStartupResume(): void {
    /** Optional storage callbacks cannot retarget cleanup into a replacement account. */
    const runId = this.resumeRetry;
    this.resumeRetry = null;
    if (runId) this.persistence.clear(this.entry.ownerId, runId);
  }
  /** Cleanup is scoped to this lifetime's last observed revision. */
  private clearRecovery(): void {
    /** Adapter notification may install a newer account-bound recovery revision. */
    const id = this.recoveryId;
    if (id) this.recovery.clear(this.entry.ownerId, id);
    if (this.recoveryId === id) this.recoveryId = null;
  }
  /** Safe adapter error reporting for optional provider effects. */
  reportError = (error: string | null): void => {if (this.active) this.update({error: raceErrorKey(error)});};
  /** Captures optional-dialog ownership without exposing mutable protocol state to adapters. */
  captureJourney = (): (() => boolean) => {
    /** Navigation, discovery, rematch and entry replacement invalidate this exact visit. */
    const generation = this.generation;
    /** Authority screen/run changes also invalidate dialogs while harmless clock ticks do not. */
    const {stage, run, published} = this.state;
    return () => this.active && generation === this.generation && stage === this.state.stage &&
      run?.runId === this.state.run?.runId && published?.challengeId === this.state.published?.challengeId;
  };
  /** Player navigation ends outstanding reads and discovery without losing a live attempt. */
  navigate = (stage: "categories" | "inbox" | "tournaments"): void => {
    if (!this.active || this.state.run && ["prepared", "scheduled", "active"].includes(this.state.run.status) && ["countdown", "racing"].includes(this.state.stage)) return;
    if (stage === "categories") {this.rematch(); return;}
    this.generation++;
    /** Navigation notifications cannot overwrite a replacement journey's delivery. */
    const current = this.captureLifetime();
    this.clearRecovery();
    if (!current()) return;
    this.clearStartupResume();
    if (!current()) return;
    this.cancelMatchWait?.();
    this.cancelMatchWait = null;
    this.command = null;
    this.mutationRetry = null;
    this.startRetry = null;
    this.resumeDraft = null;
    this.play.dispose();
    if (!current()) return;
    this.matchIntent = null;
    this.update({stage, findingOpponent: false, error: null, matchSearchStatus: "idle", matchFailure: null, matchRetryReady: true});
    if (!current()) return;
    this.matchOffer = null;
    if (stage === "inbox" && this.clock.now() - this.inboxLoadedAt >= 30_000) this.send("raceInbox", "game:listRaceInbox", {limit: 20});
  };
  /** Begins a fresh immutable race attempt and invalidates previous completion work. */
  begin = (categoryId: RaceCategoryId, challengeId = selectedRaceChallengeId(this.state), fallbackOfferId?: string): void => {
    if (!this.active || this.state.pending || this.state.findingOpponent) return;
    if (isCreatorRaceEntry(this.state, challengeId)) {this.navigate("inbox"); return;}
    this.authority.reset();
    this.generation++;
    /** Preparation notifications and selection effects cannot migrate this start. */
    const current = this.captureLifetime();
    this.clearStartupResume();
    if (!current()) return;
    this.matchIntent = null;
    this.play.dispose();
    if (!current()) return;
    this.outcomeRequested = false;
    this.shareAfterPublish = false;
    this.mutationRetry = null;
    this.startRetry = null;
    this.resumeDraft = null;
    this.preparationAt = this.clock.now();
    this.loadedAt = null;
    this.inboxLoadedAt = -Infinity;
    this.update({run: null, outcome: null, published: null, publishRequested: false, stage: "countdown", activeChallengeId: challengeId,
      loadingProgress: 0, countdown: 3, countdownReady: false, closeAfterStart: false, feedback: null, penaltyFlash: null, currentLetters: [], raceGuesses: [],
      matchSearchStatus: "idle", matchFailure: null, matchRetryReady: true});
    if (!current()) return;
    this.analytics("race_category_selected", {categoryId});
    if (!current()) return;
    if (this.rivalryId) this.analytics("race_counter_challenge_started", {categoryId});
    if (!current()) return;
    this.send("raceStart", "game:startRace", {locale: this.entry.locale, includeEvaluation: true, prepare: true,
      ...(challengeId ? {challengeId, ...(this.matchOffer?.challengeId === challengeId ? {offerId: this.matchOffer.id} : {})}
        : {categoryId, ...(fallbackOfferId ? {fallbackOfferId} : this.rivalryId ? {rivalryChallengeId: this.rivalryId} : {})})});
  };
  /** Clears the complete attempt atomically before starting a rematch or returning to catalog. */
  rematch = (categoryId?: RaceCategoryId, rivalryId?: string): void => {
    if (!this.active) return;
    this.generation++;
    /** Recovery cleanup and reset notifications retain the original rematch owner. */
    const current = this.captureLifetime();
    /** Selection and cleanup retain the confirmed run before reset. */
    const run = this.authority.run ?? this.state.run;
    /** Fallback rematches discover a fresh opponent instead of replaying a recorded challenge. */
    const fallbackRematch = Boolean(categoryId && !rivalryId && run?.role === "challenger" &&
      !run.challengeId && run.opponent);
    /** Capture cleanup identity before discarding this run's private contract. */
    const runId = this.ownedRunId;
    this.authority.reset();
    this.clearRecovery();
    if (!current()) return;
    this.clearStartupResume();
    if (!current()) return;
    if (this.state.run) this.persistence.clear(this.entry.ownerId, runId);
    if (!current()) return;
    this.rivalryId = rivalryId ?? run?.challengeId ?? run?.rivalryChallengeId ?? this.state.challenge?.challengeId;
    this.cancelMatchWait?.();
    this.cancelMatchWait = null;
    this.matchOffer = null;
    this.matchIntent = null;
    this.play.dispose();
    if (!current()) return;
    this.command = null;
    this.outcomeRequested = false;
    this.shareAfterPublish = false;
    this.mutationRetry = null;
    this.startRetry = null;
    this.resumeDraft = null;
    this.loadedAt = null;
    if (!resetOwnedRaceState({...this.entry, challengeId: undefined, openInbox: false, tournamentLocale: undefined},
      () => this.clock.now(), current, state => this.update(state), {categories: this.state.categories, inboxItems: this.state.inboxItems})) return;
    if (fallbackRematch) {
      /** Current provider adapter retains the accepted scope for the replacement search. */
      const adapter = resolveRaceMatchmaking(this.options.getMatchmaking, this.lastMatchmaking);
      if (adapter && current()) void this.findOpponent(adapter, categoryId);
    } else if (categoryId) this.begin(categoryId, undefined);
    else this.restoreCatalog();
  };
  /** Retains close intent until the server-owned preparation can be safely abandoned. */
  requestClose = (): void => {
    if (!this.active) return;
    /** A close-intent observer may replace the account before abandonment is dispatched. */
    const current = this.captureLifetime();
    if (this.state.stage === "countdown" && ["raceStart", "raceReady"].includes(this.state.pending ?? "")) {this.update({closeAfterStart: true}); return;}
    if (this.state.run && ["prepared", "scheduled", "active"].includes(this.state.run.status)) {
      if (this.state.stage === "countdown") {this.update({closeAfterStart: true}); if (current()) this.abandon();}
      else this.update({quitConfirmationOpen: true});
      return;
    }
    this.close();
  };
  /** Drops local lifetime before notifying the rendering adapter to close. */
  private close(): void {
    /** A close may dispose only the account which initiated its cleanup. */
    const current = this.captureLifetime(), generation = this.generation;
    this.clearRecovery();
    if (!current()) return;
    // A confirmed result stays recoverable until the player acknowledges it.
    if (this.state.run && this.ownedRunId && this.notifiedRuns.has(this.ownedRunId))
      this.persistence.clear(this.entry.ownerId, this.ownedRunId);
    if (!current()) return;
    this.dispose();
    if (this.generation === generation + 1 && !this.active) this.emit({kind: "close"});
  }
  /** Cancels failed quit intent while leaving an in-flight abandonment owned until confirmation. */
  dismissQuit = (): void => {
    if (this.state.pending === "raceAbandon") return;
    /** Resume after dismissal must retain the same owned quit attempt. */
    const current = this.captureLifetime();
    /** An already-applied quit cannot be undone by dismissing its error dialog. */
    const recoverRunId = this.mutationRetry?.operation === "raceAbandon" && this.mutationRetry.runId === this.ownedRunId ? this.mutationRetry.runId : null;
    if (recoverRunId && this.mutationRetry) this.mutationRetry = {...this.mutationRetry, recoverOnly: true};
    this.update({quitConfirmationOpen: false, closeAfterStart: false, error: null});
    if (current() && recoverRunId && !this.state.pending) this.send("raceResume", "game:resumeRace", {runId: recoverRunId, includeEvaluation: true});
  };
  /** Sends one abandonment mutation for the owned run. */
  abandon = (): void => {
    if (this.state.run && !this.state.pending) {
      if (this.mutationRetry?.operation === "raceAbandon") this.mutationRetry = {...this.mutationRetry, recoverOnly: false};
      this.send("raceAbandon", "game:abandonRace", {runId: this.state.run.runId},
        this.mutationRetry?.operation === "raceAbandon" && this.mutationRetry.runId === this.ownedRunId ? this.mutationRetry.requestId : undefined);
    }
  };
  /** Processes an untrusted bridge result exactly once inside the owning lifetime. */
  receive = (raw: unknown): void => {
    if (!this.active) return;
    /** Envelope parsing and timer acknowledgment retain the original account generation. */
    const current = this.captureLifetime();
    /** Validated bridge envelope; malformed or unrelated traffic does not consume a receipt. */
    let message;
    try {message = parseHostToGameMessage(raw);} catch {return;}
    if (message.type !== "host:operationResult") return;
    /** Matching command context remains private until its response is accepted. */
    const command = this.command;
    if (!current() || !command || message.payload.operation !== command.operation || !this.play.acceptResponse(message.requestId, command.operation) || !current()) return;
    this.command = null;
    /** A valid terminal start must not be retained as a failed preparation retry. */
    let accepted = false;
    try {
      if (!message.payload.ok) {this.reject(command.operation, message.payload.error ?? "RaceTo10.ERROR_GENERIC", command.runId); return;}
      /** One receipt-time observation anchors validation, accepted ownership and feedback. */
      const receivedAt = this.clock.now();
      /** Parses and checks ownership before committing any authority state. */
      let patch = applyRaceAuthority(requestedRaceState(this.state, command), command.operation, message.payload.data, this.play, receivedAt, this.entry.locale, this.resumeDraft, this.authority.run,
        this.authority.outcome, current, run => this.authority.previewHistory(run), run => this.authority.attempts(run));
      if (!current()) return;
      assertRequestedRaceRun(command, patch.run);
      if (command.operation === "raceResume" && !this.authority.run && patch.run) {
        patch = {...patch, ...this.drafts.restore(this.entry.ownerId, patch.run, () => this.wallNow(), current)};
        if (!current()) return;
      }
      if (patch.run) {patch = {...patch, run: this.authority.confirmRun(patch.run, receivedAt)}; this.play.confirmRunRefresh();}
      if (command.operation === "raceOutcome" && patch.outcome) this.authority.confirmOutcome(patch.outcome);
      if (command.operation === "raceCategories") patch = {...patch, ...recoveredRaceCatalog(this.state, this.matchIntent)};
      accepted = true;
      this.update({...patch, allowTypingWhilePending: this.play.typingWhilePending});
      if (!current()) return;
      this.feedbackUntil = this.penaltyUntil = receivedAt + 1600;
      this.persist(command.selectNewRun, command.operation === "raceStart");
      if (current()) this.afterAuthority(command.operation);
    } catch {if (current()) this.reject(command.operation, "RaceTo10.ERROR_INVALID_RESPONSE", command.runId);}
    finally {
      if (current()) {
        if (command.operation === "raceStart" && !accepted && !this.state.run && message.requestId) {
          this.startRetry = {payload: command.payload, requestId: message.requestId};
        }
        if (command.runId === this.ownedRunId && command.runId && message.requestId &&
          (command.operation === "racePublish" && !this.state.published || command.operation === "raceAbandon" && this.state.run?.status !== "abandoned")) {
          this.mutationRetry = {operation: command.operation, runId: command.runId, requestId: message.requestId};
        }
        this.play.finish(command.operation);
        if (current()) this.reconcileTerminal();
        if (current()) this.flushPublication();
      }
    }
  };
  /** Restores provisional input and clocks on both malformed and rejected receipts. */
  private reject(operation: RaceOperation, error: string, requestedRunId?: string): void {
    /** Rejection cleanup belongs to the original journey. */
    const current = this.captureLifetime();
    /** Full rollback checkpoint retained by RacePlay. */
    const rollback = this.play.rejectProjection(operation);
    if (rollback?.kind === "guess" && this.state.run?.currentRiddle && this.state.run.runId === rollback.draftRun.runId &&
      (rollback.draftEdited || this.state.run.currentRiddle.riddleId !== rollback.draftRun.currentRiddle?.riddleId ||
        this.state.run.currentRiddle.position !== rollback.draftRun.currentRiddle?.position)) {
      this.resumeDraft = structuredClone({run: this.state.run, currentLetters: this.state.currentLetters,
        activeSlotIndex: this.state.activeSlotIndex, raceGuesses: this.state.run.currentRiddle.position === rollback.draftRun.currentRiddle?.position
          ? rollback.guesses : this.state.raceGuesses});
    }
    if (rollback?.kind === "guess") this.update({...(rollback.run ? {run: rollback.run, receivedAtMs: rollback.receivedAt} : {}), currentLetters: rollback.letters, raceGuesses: rollback.guesses, feedback: null});
    else if (rollback) this.update({run: rollback.run, receivedAtMs: rollback.receivedAt, ...raceAttemptState(rollback.run),
      ...(rollback.letters ? {currentLetters: rollback.letters} : {}), ...(rollback.guesses ? {raceGuesses: rollback.guesses} : {}),
      ...(rollback.activeSlotIndex !== undefined ? {activeSlotIndex: rollback.activeSlotIndex} : {}), penaltyFlash: null});
    if (!current()) return;
    this.update(raceRejectedState(error, operation, this.play.requiresRunRefresh, this.play.typingWhilePending));
    if (!current()) return;
    if (operation === "raceEntry" && raceEntryView(this.state)?.status === "waiting") this.scheduleEntryPoll();
    if (operation === "racePublish") {this.shareAfterPublish = false; this.update({publishRequested: false});}
    if (operation === "raceBlock" || operation === "raceReport") this.update({safetyTargetUserId: null});
    if (operation === "raceStart") {
      this.update({run: null, stage: this.state.activeChallengeId ? "challenge" : "categories"});
      if (current() && this.state.closeAfterStart) this.close();
    } else if (operation === "raceResume" && !this.state.run) {
      // Transport errors and invalid data cannot prove the saved authority-owned run disappeared.
      this.resumeRetry = requestedRunId ?? this.resumeRetry;
      this.update({run: null, stage: "categories"});
    }
  }
  /** All authority follow-up commands and one-time completion effects stay behind the session seam. */
  private afterAuthority(operation: RaceOperation): void {
    /** Optional effects and observers may synchronously navigate or replace the account. */
    const generation = this.generation;
    /** Follow-up work stops as soon as its original journey is replaced. */
    const current = () => this.active && generation === this.generation;
    /** Latest validated state for chained transitions. */
    const {run, outcome, published} = this.state;
    if (run?.status === "abandoned" && ["raceStart", "raceResume", "raceReady", "raceGuess", "raceHint", "raceSkip"].includes(operation)) {
      /** Entry recovery and concurrent mutation delivery share one terminal hub/close transition. */
      const shouldClose = this.state.closeAfterStart;
      this.startRetry = null; this.resumeRetry = null; this.mutationRetry = null;
      this.authority.reset();
      this.resumeDraft = null;
      this.matchOffer = null;
      this.rivalryId = undefined;
      this.update({run: null, outcome: null, stage: "categories", activeChallengeId: undefined, challenge: null,
        entryStatus: null, closeAfterStart: false, quitConfirmationOpen: false, penaltyFlash: null, ...raceAttemptState(run)});
      if (!current()) return;
      if (shouldClose) this.close();
      else if (!this.state.categories.length) this.restoreCatalog(true);
      return;
    }
    if (["raceStart", "raceResume", "raceReady"].includes(operation) && run) {
      if (operation === "raceResume") {this.resumeDraft = null; this.resumeRetry = null;}
      if (operation === "raceStart") this.startRetry = null;
      if (operation === "raceResume" && this.mutationRetry?.operation === "raceAbandon" && this.mutationRetry.recoverOnly && this.mutationRetry.runId === run.runId) this.mutationRetry = null;
      if (this.state.closeAfterStart) this.send("raceAbandon", "game:abandonRace", {runId: run.runId});
      else {
        this.update({stage: ["prepared", "scheduled"].includes(run.status) || operation === "raceStart" ? "countdown" : "racing"});
        if (!current()) return;
        if (run.status === "prepared") this.send("raceReady", "game:readyRace", {runId: run.runId, includeEvaluation: true});
        else if (this.loadedAt === null) this.loadedAt = this.clock.now();
        if (!current()) return;
        if (operation === "raceStart") {this.analytics("race_started", {kind: this.state.activeChallengeId ? "challenge" : "creator"}); if (current()) this.analytics("race_attempt_started", {categoryId: run.categoryId});}
      }
    } else if (operation === "raceAbandon") this.close();
    else if (operation === "raceEntry" || operation === "raceInviteCancel") {
      this.entryReceivedAt = this.clock.now();
      if (raceEntryView(this.state)?.status === "waiting") this.scheduleEntryPoll();
      else {this.pollAt = Infinity; this.pollAttempt = 0;}
      if (["expired", "cancelled", "unavailable"].includes(raceEntryView(this.state)?.status ?? "")) this.clearRecovery();
      if (!current()) return;
      if (raceEntryView(this.state)?.status === "ready" || existingRaceRunId(this.state)) {
        this.analytics("race_link_entered");
        if (!current()) return;
        /** Resume only the privately accepted attempt for this entry. */
        const existingRunId = existingRaceRunId(this.state);
        if (existingRunId) this.send("raceResume", "game:resumeRace", {runId: existingRunId, includeEvaluation: true});
      }
    } else if (operation === "raceChallenge") this.analytics("race_link_entered");
    else if (operation === "raceInbox") {this.inboxLoadedAt = this.clock.now(); this.analytics("race_inbox_viewed", {resultCount: this.state.inboxItems.length});}
    else if (operation === "raceHint") this.analytics("race_hint_used", {penaltyMs: run?.rules.hintPenaltyMs ?? 15000});
    else if (operation === "raceSkip") this.analytics("race_skip_used", {penaltyMs: run?.rules.skipPenaltyMs ?? 45000});
    else if (operation === "raceOutcome" && outcome && !this.notifiedRuns.has(outcome.runId)) {
      this.notifiedRuns.add(outcome.runId);
      this.analytics("race_completed", {result: outcome.result, correctCount: outcome.correctCount, hintPenaltyMs: outcome.hintPenaltyMs, skipPenaltyMs: outcome.skipPenaltyMs, adjustedFinishMs: outcome.adjustedFinishMs});
      if (!current()) return;
      this.analytics("race_attempt_completed", {result: outcome.result, adjustedFinishMs: outcome.adjustedFinishMs});
      if (!current()) return;
      this.analytics("race_result_viewed", {result: outcome.result});
      if (current()) this.emit({kind: "outcome", outcome});
    } else if (operation === "racePublish" && published) {
      this.mutationRetry = null;
      this.analytics("race_challenge_published", {categoryId: published.preview.categoryId});
      if (!current()) return;
      this.emit({kind: "publication", publication: published, share: this.shareAfterPublish});
      if (current()) this.shareAfterPublish = false;
    }
  }
  /** Persists authority-issued ownership, never projected scores or player input. */
  private persist(selectNewRun: boolean, allowMissingRun: boolean): void {
    if (!this.state.run) return;
    /** Adapter callbacks cannot retarget an old accepted response's persistence work. */
    const current = this.captureLifetime(), run = this.authority.run ?? this.state.run, ownerId = this.entry.ownerId;
    this.clearRecovery();
    if (!current()) return;
    persistConfirmedRace(run, ownerId, this.persistence, current, selectNewRun, allowMissingRun);
  }
  /** Browser clocks drive one module-owned transition, including background recovery. */
  tick = (): void => {
    if (!this.active) return;
    /** Clock notifications and expiry cleanup can replace this authenticated visit. */
    const current = this.captureLifetime();
    /** Capture the original selection before an optional resolver can replace this journey. */
    const adapter = this.matchIntent?.adapter;
    if (adapter && !ownsRaceMatchmaking(this.options.getMatchmaking, adapter) && current()) this.retireDiscovery(this.state.stage);
    if (!current()) return;
    /** Monotonic time shared by countdown, display and rollback. */
    const now = this.clock.now(); this.drafts.retryCleanup(now); if (!current()) return;
    /** Clock/presentation updates are published atomically. */
    const patch: {-readonly [K in keyof RaceSessionState]?: RaceSessionState[K]} = {};
    if (this.matchIntent?.failure && !this.cancelMatchWait) {
      patch.matchRetryReady = canRetryRaceMatch(this.matchIntent, now);
    }
    if (this.state.feedback && now >= this.feedbackUntil) patch.feedback = null;
    if (this.state.penaltyFlash && now >= this.penaltyUntil) patch.penaltyFlash = null;
    if (this.state.stage === "countdown" && !this.state.closeAfterStart) {
      if (this.loadedAt === null) patch.loadingProgress = advanceRaceLoadingProgress(Math.floor((now - this.preparationAt) / 100) * 5, false);
      else {
        patch.loadingProgress = 100;
        if (now - this.loadedAt >= 300) {
          patch.countdownReady = true;
          /** Server schedule is anchored to receipt time, regardless of wall-clock skew. */
          const run = this.authority.run ?? this.state.run;
          if (run?.startsAtMs !== undefined && run.serverNowMs !== undefined) {
            /** Visibility recovery advances directly to the authoritative start. */
            const serverNowMs = estimatedRaceServerNow(run.serverNowMs, this.authority.run ? this.authority.receivedAtMs : this.state.receivedAtMs, now);
            patch.countdown = scheduledRaceCountdown(run.startsAtMs, serverNowMs);
            if (serverNowMs >= run.startsAtMs) {
              // Keep the established GO interval without shifting the server-issued scored clock.
              if (serverNowMs >= run.startsAtMs + RACE_GO_DISPLAY_MS) patch.stage = "racing";
              if (run.status === "scheduled") {patch.run = {...structuredClone(run), status: "active", serverNowMs, wallElapsedMs: serverNowMs - run.startsAtMs, adjustedElapsedMs: serverNowMs - run.startsAtMs + run.totalPenaltyMs}; patch.receivedAtMs = now;}
            }
          } else {patch.countdown = Math.max(0, 3 - Math.floor((now - this.loadedAt - 300) / 1000)); if (now - this.loadedAt >= 3480) patch.stage = "racing";}
        }
      }
    }
    if (this.state.stage === "racing" || patch.stage === "racing") patch.adjustedNow = getAdjustedRaceTime(patch.run ?? this.state.run, patch.receivedAtMs ?? this.state.receivedAtMs, now);
    if (Object.entries(patch).some(([key, value]) => Reflect.get(this.state, key) !== value)) this.update(patch);
    if (!current()) return;
    this.reconcileTerminal();
    if (!current()) return;
    /** Waiting transitions use privately accepted capability and deadline facts. */
    const entry = raceEntryView(this.state);
    if (this.state.stage === "challenge" && entry?.status === "waiting") {
      /** Deadline comes from authority time anchored to this response receipt. */
      if (estimatedRaceServerNow(entry.serverNowMs, this.entryReceivedAt, now) >= entry.invitation.expiresAtMs) {
        this.pollAt = Infinity;
        this.clearRecovery();
        if (!current()) return;
        this.update({entryStatus: {...entry, status: "expired"}, error: null});
      } else if (this.visible && !this.state.pending && now >= this.pollAt && selectedRaceChallengeId(this.state)) {
        this.pollAt = Infinity;
        this.send("raceEntry", "game:getRaceEntry", {challengeId: selectedRaceChallengeId(this.state), locale: this.entry.locale});
      }
    }
  };
  /** Pauses polling while hidden and refreshes once upon visible recovery. */
  setVisible = (visible: boolean): void => {
    if (!this.visible && visible && raceEntryView(this.state)?.status === "waiting") this.pollAt = this.clock.now();
    this.visible = visible;
    if (visible) this.tick();
  };
  /** Bounded exponential backoff and jitter prevent synchronized waiting clients. */
  private scheduleEntryPoll(): void {
    this.pollAt = nextRaceEntryPollAt(this.pollAttempt++, this.clock.now(), this.options.random ?? Math.random);
  }
  /** Creator cancellation uses the invitation's explicit capability, never an ID prefix. */
  cancelInvitation = (): void => {
    /** Open and incompatible creator views share the same privately accepted capability. */
    const entry = raceEntryView(this.state);
    if (!this.active || this.state.pending || !selectedRaceChallengeId(this.state) || !canCancelRaceInvitation(entry)) return;
    this.send("raceInviteCancel", "game:cancelRaceInvite", {challengeId: selectedRaceChallengeId(this.state), locale: this.entry.locale});
  };
  /** Projects terminal presentation only after pending mutations can no longer change it. */
  private reconcileTerminal(): void {
    if (!this.active || this.state.pending || this.state.closeAfterStart || this.mutationRetry?.operation === "raceAbandon" ||
      !this.state.run || !["racing", "result"].includes(this.state.stage)) return;
    if (!this.state.outcome) {
      /** Provisional result computed exclusively from the latest authority view. */
      const outcome = this.play.projectOutcome(this.state.run, getAdjustedRaceTime(this.state.run, this.state.receivedAtMs, this.clock.now()));
      if (outcome) this.update({outcome, stage: "result", error: null});
    }
    if (this.state.stage === "result" && !this.outcomeRequested) {this.outcomeRequested = true; this.send("raceOutcome", "game:getRaceOutcome", {runId: this.state.run.runId});}
  }
  /** Submits only a complete draft for the current active riddle. */
  submit = (): void => {
    /** Submission uses original authority riddle even when a successor is projected immediately. */
    const {run, currentLetters, raceGuesses, receivedAtMs} = this.state;
    if (!this.active || this.play.requiresRunRefresh || run?.status !== "active" || !run.currentRiddle || this.state.pending || currentLetters.length !== run.currentRiddle.answerLength || currentLetters.some(letter => !letter)) return;
    /** Projection is observable but its command still belongs to this originating journey. */
    const current = this.captureLifetime();
    /** Private checkpoint preserves input and receipt time on rejection. */
    const projection = this.play.projectGuess(run, currentLetters, raceGuesses, receivedAtMs);
    if (projection) this.update({pending: "raceGuess", currentLetters: projection.letters, activeSlotIndex: projection.slot, raceGuesses: projection.guesses, feedback: projection.feedback,
      ...(projection.run ? {run: projection.run, receivedAtMs: this.clock.now()} : {})});
    if (!current()) return;
    this.feedbackUntil = this.clock.now() + 1600;
    this.send("raceGuess", "game:submitRaceGuess", {runId: run.runId, riddleId: run.currentRiddle.riddleId, guess: currentLetters.join(""), includeEvaluation: true});
  };
  /** Paid hint and skip share one checkpoint, validation and delivery implementation. */
  private paid(operation: "raceHint" | "raceSkip"): void {
    /** Original riddle determines the paid authority mutation. */
    const {run, receivedAtMs, currentLetters, raceGuesses, activeSlotIndex} = this.state;
    if (!this.active || this.play.requiresRunRefresh || run?.status !== "active" || !run.currentRiddle || this.state.pending) return;
    if (operation === "raceHint" && (!run.currentRiddle.hintAvailable || run.currentRiddle.revealedLetters.length >= run.rules.maxHintsPerRiddle)) return;
    /** Paid projection and delivery must retain one account and checkpoint. */
    const current = this.captureLifetime();
    /** Immediate projection from the complete immutable deck. */
    const projected = this.play.projectPaid(operation, run, receivedAtMs, {letters: currentLetters, guesses: raceGuesses, activeSlotIndex});
    if (projected) {
      /** A hint changes revealed positions on this question while retaining the player's remaining draft. */
      const hintedLetters = [...currentLetters];
      for (const revealed of projected.currentRiddle?.revealedLetters ?? []) hintedLetters[revealed.index] = revealed.letter;
      this.update({pending: operation, run: projected, receivedAtMs: this.clock.now(), ...raceAttemptState(projected),
        ...(operation === "raceHint" ? {currentLetters: hintedLetters, raceGuesses,
          activeSlotIndex: projected.currentRiddle && isRaceSlotEditable(projected.currentRiddle, activeSlotIndex)
            ? activeSlotIndex : raceAttemptState(projected).activeSlotIndex} : {}),
        penaltyFlash: operation === "raceHint" ? "RaceTo10.HINT_PENALTY" : "RaceTo10.SKIP_PENALTY"});
    }
    if (!current()) return;
    this.penaltyUntil = this.clock.now() + 1600;
    this.send(operation, operation === "raceHint" ? "game:requestRaceHint" : "game:skipRaceRiddle", {runId: run.runId, riddleId: run.currentRiddle.riddleId, includeEvaluation: true});
  }
  /** Requests the next authority-selected hint. */ hint = (): void => this.paid("raceHint");
  /** Requests an authority-scored skip. */ skip = (): void => this.paid("raceSkip");
  /** Input stays behind the session seam, including provisional successor typing. */
  input = (kind: "letter" | "text" | "backspace" | "slot", value: string | number = ""): void => {
    /** Current displayed riddle accepting local input. */
    const riddle = this.state.run?.currentRiddle;
    if (!this.active || this.state.stage !== "racing" || !riddle || this.state.pending && !this.play.typingWhilePending) return;
    /** Pure editing publishes only valid changed drafts; pending intent remains separate from rollback. */
    const draft = {letters: this.state.currentLetters, activeSlotIndex: this.state.activeSlotIndex};
    /** Device composition, keys, deletion and slot focus use one bounded editing policy. */
    const next = editRaceInput(riddle, draft, kind, value);
    if (next.letters === draft.letters && next.activeSlotIndex === draft.activeSlotIndex) return;
    if (!this.state.pending) this.resumeDraft = null;
    this.play.noteDraftEdit();
    this.update({currentLetters: next.letters, activeSlotIndex: next.activeSlotIndex});
  };
  /** Records publication intent while authoritative outcome reconciliation is pending. */
  publish = (): void => {if (!this.active || !this.state.run || this.state.published || this.state.publishRequested) return;
    /** Publication intent remains bound across its state notification. */
    const current = this.captureLifetime(); this.shareAfterPublish = true; this.update({publishRequested: true}); if (current()) this.flushPublication();};
  /** Publication cannot escape unresolved projection or authority completion. */
  private flushPublication(): void {
    /** Publication eligibility is anchored to the confirmed recording, never its mutable display ID. */
    const run = this.authority.run ?? this.state.run;
    if (this.state.publishRequested && !this.state.published && run && this.play.canPublish(run) && this.notifiedRuns.has(run.runId)) {
      this.send("racePublish", "game:publishRace", {runId: run.runId},
        this.mutationRetry?.operation === "racePublish" && this.mutationRetry.runId === run.runId ? this.mutationRetry.requestId : undefined);
    }
  }

  /** Safety mutations retain their target alongside the correlated command. */
  safety = (kind: "block" | "report", item: RaceInboxItem, category?: SocialReportCategory): void => {
    if (!this.active || !item.opponentUserId || this.state.pending) return;
    /** Player selection is fixed before synchronous observers can edit the inbox item. */
    const targetUserId = item.opponentUserId;
    /** Reporting or blocking another player belongs to the initiating account. */
    const current = this.captureLifetime();
    this.update({safetyTargetUserId: targetUserId, safetyNotice: null});
    if (!current()) return;
    if (kind === "block") this.send("raceBlock", "game:blockRival", {targetUserId});
    else if (category) this.send("raceReport", "game:reportRival", {targetUserId, category});
  };
  /** Retries the currently owned operation without restoring an earlier screen. */
  retry = (): void => {
    if (this.state.pending || this.state.findingOpponent || this.cancelMatchWait || !this.active) return;
    /** Retry notifications may invalidate the privately retained original receipt. */
    const current = this.captureLifetime();
    if (this.resumeRetry && !this.state.run) {
      this.send("raceResume", "game:resumeRace", {runId: this.resumeRetry, includeEvaluation: true});
      return;
    }
    if (this.startRetry && !this.state.run) {
      this.preparationAt = this.clock.now(); this.loadedAt = null;
      this.update({stage: "countdown", loadingProgress: 0, countdown: 3, countdownReady: false, closeAfterStart: false});
      if (!current()) return;
      this.send("raceStart", "game:startRace", this.startRetry.payload, this.startRetry.requestId);
      return;
    }
    if (this.matchIntent?.failure) {
      if (needsRaceCatalog(this.state)) {this.restoreCatalog(); return;}
      if (!canRetryRaceMatch(this.matchIntent, this.clock.now())) return;
      /** Empty/capped/expired searches rotate deliberately; network retries retain their receipt. */
      this.matchIntent = retryRaceMatchIntent(this.matchIntent, () => (this.options.requestId ?? createRequestId)("raceMatch"));
      void this.searchMatch(this.matchIntent);
      return;
    }
    if (this.state.run && this.mutationRetry?.operation === "raceAbandon" && this.mutationRetry.runId === this.ownedRunId && this.mutationRetry.recoverOnly) this.send("raceResume", "game:resumeRace", {runId: this.state.run.runId, includeEvaluation: true});
    else if (this.state.run && (this.state.closeAfterStart && ["prepared", "scheduled", "active"].includes(this.state.run.status) ||
      this.mutationRetry?.operation === "raceAbandon" && this.mutationRetry.runId === this.ownedRunId)) this.abandon();
    else if (this.state.stage === "result" && this.state.run && !this.state.published && this.mutationRetry?.operation === "racePublish" && this.mutationRetry.runId === this.ownedRunId) this.publish();
    else if (this.state.stage === "result" && this.state.run) this.send("raceOutcome", "game:getRaceOutcome", {runId: this.state.run.runId});
    else if (this.state.run?.status === "prepared") this.send("raceReady", "game:readyRace", {runId: this.state.run.runId, includeEvaluation: true});
    else if (this.state.run && ["countdown", "racing"].includes(this.state.stage)) this.send("raceResume", "game:resumeRace", {runId: this.state.run.runId, includeEvaluation: true});
    else if (this.state.stage === "inbox") this.send("raceInbox", "game:listRaceInbox", {limit: 20});
    else if (selectedRaceChallengeId(this.state)) this.send("raceEntry", "game:getRaceEntry", {challengeId: selectedRaceChallengeId(this.state), locale: this.entry.locale});
    else this.restoreCatalog(true);
  };
  /** Explicit player search creates a new intent; Retry uses the retained intent and recovery policy. */
  findOpponent = async (matchmaking: MatchmakingCapability, categoryId?: RaceCategoryId): Promise<void> => {
    if (!this.active || this.state.findingOpponent || this.state.pending || !["categories", "inbox", "tournaments"].includes(this.state.stage)) return;
    this.lastMatchmaking = matchmaking;
    this.matchOffer = null;
    this.matchIntent = {adapter: matchmaking, request: {locale: this.entry.locale,
      ...(categoryId ? {categoryId} : {}), requestId: (this.options.requestId ?? createRequestId)("raceMatch")}, retryAtMs: this.clock.now()};
    await this.searchMatch(this.matchIntent, false);
  };
  /** Applies bounded retry guidance without exposing provider messages to the player. */
  private matchFailed(failure: RaceMatchFailure, current = this.captureLifetime()): void {
    if (!this.matchIntent || !current()) return;
    /** Accepted recovery retains its policy independently of catalog transport failures. */
    const recovery = failedRaceRecovery(this.matchIntent, failure, this.clock.now(), () => this.wallNow());
    if (recovery) this.saveRecovery(recovery, true);
    else this.clearRecovery();
    if (!current()) return;
    /** Player-facing language describes recovery, never storage or implementation budgets. */
    this.update(failedRaceDiscovery(failure, raceMatchErrorKey(failure)));
  }
  /** Retire loading and settled recovery without navigating a replacement account or live run. */
  private retireDiscovery(stage: RaceStage): void {
    this.generation++;
    /** Persistence callbacks may replace the journey after retirement has begun. */
    const current = this.captureLifetime();
    this.cancelMatchWait?.(); this.cancelMatchWait = null;
    this.clearRecovery(); if (!current()) return;
    this.matchIntent = null; this.matchOffer = null;
    this.update(idleRaceDiscovery(stage));
    if (current()) this.restoreCatalog();
  }
  /** Settled cold discovery needs category choices without replacing another journey's command. */
  private restoreCatalog(force = false): void {
    if (this.active && (force || needsRaceCatalog(this.state)))
      this.send("raceCategories", "game:listRaceCategories", {locale: this.entry.locale});
  }
  /** Provider discovery cannot navigate after a changed screen, entry or disposal. */
  private async searchMatch(intent: NonNullable<RaceSession["matchIntent"]>, preserveSelection = true): Promise<void> {
    /** Discovery lifetime changes on every player navigation. */
    this.generation++;
    /** Optional lookup must preserve the originating generation before and after it runs. */
    const lifetime = this.captureLifetime();
    /** Account, navigation and provider must all retain this exact discovery intent. */
    const current = () => ownsRaceMatchmaking(this.options.getMatchmaking, intent.adapter, lifetime);
    /** Cancellation and the original timeout share one owned delivery budget. */
    const {deadline, cancelWait} = raceMatchDelivery(this.clock);
    /** Retiring discovery must restore its original hub without touching another run. */
    const stage = this.state.stage;
    this.cancelMatchWait = cancelWait;
    try {
      this.saveRecovery({kind: "search", request: intent.request}, preserveSelection);
      if (!current()) return;
      delete intent.failure;
      this.update({findingOpponent: true, error: null, matchSearchStatus: "searching", matchFailure: null, matchRetryReady: false});
      if (!current()) return;
      /** Only the selected provider may supply the accepted discovery response. */
      const result = observeRaceMatchResult(await Promise.race([findOwnedRaceOpponent(intent.adapter, intent.request, current), deadline]), current);
      if (!result) return;
      if (result.status === "success") {
        /** Validate identity-free responses before allowing navigation or offer attribution. */
        const parsed = parseOwnedRaceMatch(result.value, intent.request);
        if (!current()) return;
        if (!parsed) {
          this.matchFailed(raceMatchFailure("invalid-response", 1000), current);
          return;
        }
        if (parsed.status === "matched") {
          this.matchOffer = parsed.offerId ? {id: parsed.offerId, challengeId: parsed.challenge.challengeId} : null;
          this.saveRecovery({kind: "challenge", challengeId: parsed.challenge.challengeId,
            ...(parsed.offerId ? {offerId: parsed.offerId} : {})}, true);
          if (!current()) return;
          this.matchIntent = null;
          this.play.dispose();
          if (!current()) return;
          this.update({activeChallengeId: parsed.challenge.challengeId, challenge: parsed.challenge, entryStatus: null,
            stage: "challenge", run: null, outcome: null, matchSearchStatus: "matched", matchFailure: null, matchRetryReady: true});
        } else if (parsed.fallback) {
          this.update({findingOpponent: false, activeChallengeId: undefined, challenge: null, entryStatus: null});
          if (current()) this.begin(parsed.fallback.categoryId, undefined, parsed.fallback.offerId);
        } else {
          intent.failure = raceMatchFailure("eligibility-changed");
          intent.retryAtMs = this.clock.now();
          this.saveRecovery({kind: "search", request: intent.request, failure: raceMatchFailure("eligibility-changed")}, true);
          if (!current()) return;
          this.update({error: "RaceTo10.MATCH_EMPTY", matchSearchStatus: "empty", matchRetryReady: true});
        }
      } else if (result.status === "cancelled") {
        this.clearRecovery();
        if (!current()) return;
        this.matchIntent = null;
        this.update({matchSearchStatus: "idle", matchRetryReady: true});
      } else {
        this.matchFailed(raceDiscoveryFailure(result), current);
      }
    } catch (error) {if (current()) this.matchFailed(classifyRaceMatchFailure(error), current);}
    finally {
      cancelWait();
      if (this.cancelMatchWait === cancelWait) this.cancelMatchWait = null;
      if (lifetime()) {
        /** Retirement also retains ownership after its final capability observation. */
        const owned = current();
        if (lifetime()) {
          if (!owned) this.retireDiscovery(stage);
          else {this.update({findingOpponent: false}); if (current()) this.restoreCatalog();}
        }
      }
    }
  }
}
