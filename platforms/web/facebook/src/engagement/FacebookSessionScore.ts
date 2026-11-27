import {RACE_MAX_ADJUSTED_TIME_MS, type RaceLocale} from "../../../../../src/races/contracts/index";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "../fbinstant";
import {parseFacebookTournamentRecordResponse} from "../facebookCallableResponses";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";
import {facebookPrivatePointsPayload, facebookSdkErrorCode, privateTournamentAccessDenied,
  readFacebookPrivatePointsTournament} from "./facebookPrivateTournament";

type RaceReceipt = ReturnType<typeof parseFacebookTournamentRecordResponse>;
type ScoreTarget = Readonly<{context: string | null; locale: RaceLocale} &
  ({kind: "session"} | {kind: "private"; tournamentId: string} | {kind: "blocked"})>;
type FailureOperation = "prepare" | "post" | "context" | "private-create" | "private-recovery";
export type FacebookSessionScoreSnapshot = Readonly<{
  available: boolean;
  pending: boolean;
  privateAvailable: boolean;
  chooseGroupAvailable: boolean;
  privateOutcome: "uncertain" | "incompatible" | null;
}>;

/** The authoritative five-minute race ceiling makes faster completed runs score higher. */
const sessionScore = (receipt: RaceReceipt): number => RACE_MAX_ADJUSTED_TIME_MS - receipt.adjustedTimeMs;
const scopeKey = (target: ScoreTarget) => JSON.stringify([target.kind,
  target.kind === "private" ? target.tournamentId : target.context, target.locale]);

/** Presents explicit native score actions after a completed official race receipt. */
export function createFacebookSessionScore({sdk, isActive, canPresent, getLocale, synchronizeContext,
  privateTournamentsEnabled = false, onContextChange, now = Date.now, reportFailure = () => undefined}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  canPresent: () => boolean;
  getLocale: () => RaceLocale;
  synchronizeContext: () => Promise<void>;
  /** Requires verified Meta allowlisting and dashboard higher-is-better points configuration. */
  privateTournamentsEnabled?: boolean;
  onContextChange?: (listener: () => void) => () => void;
  now?: () => number;
  reportFailure?: (operation: FailureOperation) => void;
}) {
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const postAsync = supported.has("postSessionScoreAsync") && typeof sdk.postSessionScoreAsync === "function"
    ? sdk.postSessionScoreAsync.bind(sdk) : undefined;
  const post = supported.has("postSessionScore") && typeof sdk.postSessionScore === "function"
    ? sdk.postSessionScore.bind(sdk) : undefined;
  const getTournament = supported.has("getTournamentAsync") && typeof sdk.getTournamentAsync === "function"
    ? sdk.getTournamentAsync.bind(sdk) : undefined;
  const getContext = typeof sdk.context?.getID === "function" ? sdk.context.getID.bind(sdk.context) : undefined;
  const createPrivate = privateTournamentsEnabled && supported.has("tournament.createPrivateAsync") &&
    typeof sdk.tournament?.createPrivateAsync === "function" ? sdk.tournament.createPrivateAsync.bind(sdk.tournament) : undefined;
  const getTournaments = privateTournamentsEnabled && supported.has("tournament.getTournamentsAsync") &&
    typeof sdk.tournament?.getTournamentsAsync === "function" ? sdk.tournament.getTournamentsAsync.bind(sdk.tournament) : undefined;
  const chooseGroup = supported.has("context.chooseAsync") && typeof sdk.context?.chooseAsync === "function"
    ? sdk.context.chooseAsync.bind(sdk.context) : undefined;
  if ((!postAsync && !post && !createPrivate) || !getTournament || !getContext) return undefined;

  const startedAt = now();
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) return undefined;
  const lifetime = new AbortController();
  const candidates = new Map<RaceLocale, RaceReceipt>();
  const attempted = new Map<string, {best: number; runs: Set<string>}>();
  const creationAttempts = new Set<string>();
  const listeners = new Set<() => void>();
  let target: ScoreTarget | undefined;
  let busy = false, privateAccessDenied = false, revision = 0;
  let privateOutcome: {context: string | null; value: "uncertain" | "incompatible"} | undefined;
  let snapshot: FacebookSessionScoreSnapshot = {available: false, pending: false,
    privateAvailable: false, chooseGroupAvailable: false, privateOutcome: null};
  const active = (locale: RaceLocale) => !lifetime.signal.aborted && isActive() && getLocale() === locale;
  const presentable = (locale: RaceLocale) => active(locale) && canPresent() &&
    (typeof document === "undefined" || document.visibilityState === "visible");
  const unattempted = (scope: ScoreTarget, receipt: RaceReceipt) => {
    const previous = attempted.get(scopeKey(scope));
    return scope.kind !== "blocked" && (!previous || (!previous.runs.has(receipt.runId) && previous.best < sessionScore(receipt)));
  };
  const remember = (scope: ScoreTarget, receipt: RaceReceipt) => {
    const key = scopeKey(scope), previous = attempted.get(key) ?? {best: -1, runs: new Set<string>()};
    previous.best = Math.max(previous.best, sessionScore(receipt));
    previous.runs.add(receipt.runId);
    attempted.set(key, previous);
  };
  const currentTarget = (locale: RaceLocale): ScoreTarget => {
    const context = getContext();
    return target?.context === context && target.locale === locale ? target : {kind: "session", context, locale};
  };
  const isGroupContext = () => {
    const type = sdk.context?.getType();
    // THREAD includes Messenger groups; only the host can distinguish a two-person group from a direct chat.
    return getContext() !== null && (type === "THREAD" || type === "GROUP");
  };
  const publishSnapshot = () => {
    const locale = getLocale(), receipt = candidates.get(locale), enabled = Boolean(receipt && active(locale));
    let available = false, privateAvailable = false, chooseGroupAvailable = false;
    let outcome: FacebookSessionScoreSnapshot["privateOutcome"] = null;
    try {
      const scope = currentTarget(locale);
      available = enabled && Boolean(postAsync || post) && Boolean(receipt && unattempted(scope, receipt));
      const privateEnabled = enabled && Boolean(createPrivate) && !privateAccessDenied;
      privateAvailable = privateEnabled && scope.kind === "session" && scope.context !== null &&
        isGroupContext() && !creationAttempts.has(scope.context);
      chooseGroupAvailable = privateEnabled && Boolean(chooseGroup);
      outcome = enabled && privateOutcome?.context === scope.context ? privateOutcome.value : null;
    } catch { /* A stale SDK context cannot expose an action. */ }
    const next = {available, pending: busy && !lifetime.signal.aborted && isActive(), privateAvailable,
      chooseGroupAvailable, privateOutcome: outcome};
    if (next.available === snapshot.available && next.pending === snapshot.pending &&
      next.privateAvailable === snapshot.privateAvailable && next.chooseGroupAvailable === snapshot.chooseGroupAvailable &&
      next.privateOutcome === snapshot.privateOutcome) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const report = (operation: FailureOperation) => {
    if (lifetime.signal.aborted || !isActive()) return;
    try {reportFailure(operation);} catch { /* Optional diagnostics cannot change a completed race. */ }
  };
  const readWithinDeadline = async <Value,>(operation: () => Promise<Value>, signal?: AbortSignal): Promise<Value | undefined> => {
    if (signal?.aborted || lifetime.signal.aborted) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    const deadline = new Promise<undefined>(resolve => {
      stop = () => resolve(undefined);
      lifetime.signal.addEventListener("abort", stop, {once: true});
      signal?.addEventListener("abort", stop, {once: true});
      timer = setTimeout(stop, 8000);
    });
    try {return await Promise.race([operation(), deadline]);}
    finally {
      if (timer !== undefined) clearTimeout(timer);
      if (stop) {lifetime.signal.removeEventListener("abort", stop); signal?.removeEventListener("abort", stop);}
    }
  };
  const inspect = async (locale: RaceLocale, signal?: AbortSignal): Promise<ScoreTarget> => {
    const context = getContext();
    const value = await readWithinDeadline(() => getTournament().then(
      tournament => ({kind: "tournament", tournament} as const), (error: unknown) => {
        if (facebookSdkErrorCode(error) === "TOURNAMENT_NOT_FOUND") return {kind: "absent"} as const;
        throw error;
      }), signal);
    if (value?.kind === "absent") return {kind: "session", context, locale};
    const compatible = value?.kind === "tournament" && privateTournamentsEnabled
      ? readFacebookPrivatePointsTournament(value.tournament, locale, now()) : null;
    return compatible && compatible.contextId === context
      ? {kind: "private", context, locale, tournamentId: compatible.id} : {kind: "blocked", context, locale};
  };
  const refresh = async () => {
    const currentRevision = ++revision, locale = getLocale();
    target = undefined;
    publishSnapshot();
    if (!active(locale)) return;
    let context: string | null;
    try {context = getContext();} catch {report("prepare"); return;}
    let inspected: ScoreTarget;
    try {inspected = await inspect(locale);} catch {inspected = {kind: "blocked", context, locale}; report("prepare");}
    try {if (revision !== currentRevision || !active(locale) || getContext() !== context) return;}
    catch {report("prepare"); return;}
    target = inspected;
    publishSnapshot();
  };
  const reconcile = async () => {
    if (lifetime.signal.aborted || !isActive()) return;
    try {await synchronizeContext();} catch {report("context");}
  };
  const reconcileMutation = async () => {
    let context: string | null | undefined;
    try {context = getContext();} catch {report("context");}
    await reconcile();
    return context;
  };
  const recoverCreation = async (receipt: RaceReceipt, resultContext: string | null | undefined) => {
    const current = () => resultContext !== undefined && active(receipt.locale) && getContext() === resultContext;
    if (!current()) return;
    try {
      const inspected = await inspect(receipt.locale);
      if (current() && inspected.context === resultContext) {
        target = inspected;
        if (inspected.kind === "private") remember(inspected, receipt);
      }
    } catch {report("private-recovery");}
    if (!getTournaments || !current()) return;
    try {
      const listed: unknown = await readWithinDeadline(getTournaments);
      if (!current() || !Array.isArray(listed)) return;
      // Eligible tournaments cannot prove which group received a failed creation; never join one speculatively.
      const currentTournament = listed.map(value => readFacebookPrivatePointsTournament(value, receipt.locale, now()))
        .find(value => value?.contextId === resultContext);
      if (currentTournament) remember({kind: "private", context: currentTournament.contextId,
        locale: receipt.locale, tournamentId: currentTournament.id}, receipt);
    } catch {report("private-recovery");}
  };
  const stopContext = onContextChange?.(() => {void refresh();});

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh,
    /** Records an opportunity only; completion never opens native UI or waits for an SDK promise. */
    record(runId: string, value: unknown): void {
      try {
        const receipt = parseFacebookTournamentRecordResponse(value), clock = now(), previous = candidates.get(receipt.locale);
        if (receipt.runId !== runId || !active(receipt.locale) || receipt.completedAtMs < startedAt ||
          !Number.isSafeInteger(clock) || receipt.completedAtMs > clock || (previous && sessionScore(receipt) <= sessionScore(previous))) return;
        candidates.set(receipt.locale, receipt);
        publishSnapshot();
      } catch {report("prepare");}
    },
    /** A mounted, player-requested action owns any platform dialog or context change. */
    async publish(signal?: AbortSignal): Promise<PlatformResult<void>> {
      const receipt = candidates.get(getLocale());
      if (busy || !receipt || (!postAsync && !post) || !presentable(receipt.locale) || signal?.aborted) {
        return {status: "unavailable", message: "facebook-session-score-unavailable"};
      }
      busy = true;
      publishSnapshot();
      try {
        const requestedContext = getContext();
        return await runFacebookSdkDialog(sdk, async () => {
          const current = () => !signal?.aborted && candidates.get(receipt.locale) === receipt &&
            presentable(receipt.locale) && getContext() === requestedContext;
          if (!current() || !unattempted(currentTarget(receipt.locale), receipt)) return {status: "cancelled"};
          const scope = await inspect(receipt.locale, signal);
          if (!current() || scope.context !== getContext() || scope.kind === "blocked") {
            return {status: "unavailable", message: "facebook-session-score-context-unavailable"};
          }
          target = scope;
          if (!unattempted(scope, receipt)) return {status: "cancelled"};
          // Mark before calling: an SDK rejection can follow a delivered side effect.
          remember(scope, receipt);
          let posted = true, resultContext: string | null | undefined;
          try {if (postAsync) await postAsync(sessionScore(receipt)); else post?.(sessionScore(receipt));}
          catch {posted = false; report("post");}
          finally {resultContext = await reconcileMutation();}
          if (resultContext !== undefined && active(receipt.locale) && getContext() === resultContext && resultContext !== scope.context) {
            try {
              const resulting = await inspect(receipt.locale);
              if (active(receipt.locale) && resulting.context === resultContext && getContext() === resultContext) {
                target = resulting;
                if (resulting.kind !== "blocked") remember(resulting, receipt);
              }
            } catch {report("prepare");}
          }
          return posted ? {status: "success", value: undefined} : {status: "retryable-failure", message: "facebook-session-score-failed"};
        });
      } catch {report("prepare"); return {status: "retryable-failure", message: "facebook-session-score-failed"};}
      finally {busy = false; publishSnapshot();}
    },
    /** Starting a private competition posts a group leaderboard; this is always an explicit player action. */
    async startPrivateTournament({chooseGroup: selectGroup = false, signal}: {chooseGroup?: boolean; signal?: AbortSignal} = {}): Promise<PlatformResult<void>> {
      const receipt = candidates.get(getLocale());
      if (busy || !receipt || !createPrivate || privateAccessDenied || !presentable(receipt.locale) || signal?.aborted ||
        (selectGroup && !chooseGroup)) return {status: "unavailable", message: "facebook-private-tournament-unavailable"};
      busy = true;
      publishSnapshot();
      try {
        let selectedContext = getContext();
        return await runFacebookSdkDialog(sdk, async () => {
          const current = () => !signal?.aborted && candidates.get(receipt.locale) === receipt &&
            presentable(receipt.locale) && getContext() === selectedContext;
          if (!current()) return {status: "cancelled"};
          if (selectGroup && chooseGroup) {
            try {await chooseGroup({minSize: 3}); selectedContext = getContext();}
            catch (error) {
              return facebookSdkErrorCode(error) === "USER_INPUT" ? {status: "cancelled"} :
                {status: "retryable-failure", message: "facebook-private-group-selection-failed"};
            } finally {await reconcile();}
          }
          if (!current()) return {status: "cancelled"};
          const scope = await inspect(receipt.locale, signal);
          if (!current() || scope.context !== getContext() || scope.kind !== "session" || !isGroupContext() ||
            scope.context === null || creationAttempts.has(scope.context)) {
            return {status: "unavailable", message: "facebook-private-tournament-context-unavailable"};
          }
          creationAttempts.add(scope.context);
          let created: unknown;
          try {created = await createPrivate({initialScore: sessionScore(receipt), data: facebookPrivatePointsPayload(receipt.locale)});}
          catch (error) {
            if (privateTournamentAccessDenied(error)) privateAccessDenied = true;
            report("private-create");
            const resultContext = await reconcileMutation();
            if (!privateAccessDenied && resultContext !== undefined) privateOutcome = {context: resultContext, value: "uncertain"};
            await recoverCreation(receipt, resultContext);
            return {status: "unavailable", message: privateAccessDenied ? "facebook-private-tournament-unavailable" : "facebook-private-tournament-outcome-unknown"};
          }
          const resultContext = await reconcileMutation();
          if (!active(receipt.locale) || resultContext === undefined || getContext() !== resultContext) return {status: "cancelled"};
          const compatible = readFacebookPrivatePointsTournament(created, receipt.locale, now());
          if (!compatible || compatible.contextId !== getContext()) {
            privateOutcome = {context: resultContext, value: "incompatible"};
            target = {kind: "blocked", context: getContext(), locale: receipt.locale};
            return {status: "unavailable", message: "facebook-private-tournament-incompatible"};
          }
          target = {kind: "private", context: compatible.contextId, locale: receipt.locale, tournamentId: compatible.id};
          privateOutcome = undefined;
          remember(target, receipt);
          return {status: "success", value: undefined};
        });
      } catch {report("prepare"); return {status: "retryable-failure", message: "facebook-private-tournament-failed"};}
      finally {busy = false; publishSnapshot();}
    },
    retire() {
      lifetime.abort();
      stopContext?.();
      revision++;
      busy = false;
      candidates.clear();
      attempted.clear();
      creationAttempts.clear();
      publishSnapshot();
      listeners.clear();
    },
  };
}

export type FacebookSessionScore = NonNullable<ReturnType<typeof createFacebookSessionScore>>;
