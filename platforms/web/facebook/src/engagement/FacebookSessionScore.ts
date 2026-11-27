import {RACE_MAX_ADJUSTED_TIME_MS, type RaceLocale} from "../../../../../src/races/contracts/index";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "../fbinstant";
import {parseFacebookTournamentRecordResponse} from "../facebookCallableResponses";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";

type RaceReceipt = ReturnType<typeof parseFacebookTournamentRecordResponse>;
export type FacebookSessionScoreSnapshot = Readonly<{available: boolean; pending: boolean}>;

/** The authoritative five-minute race ceiling makes faster completed runs score higher. */
const sessionScore = (receipt: RaceReceipt): number => RACE_MAX_ADJUSTED_TIME_MS - receipt.adjustedTimeMs;

/** Presents an explicit native score action after a completed official race receipt. */
export function createFacebookSessionScore({sdk, isActive, canPresent, getLocale, synchronizeContext,
  now = Date.now, reportFailure = () => undefined}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  canPresent: () => boolean;
  getLocale: () => RaceLocale;
  synchronizeContext: () => Promise<void>;
  now?: () => number;
  reportFailure?: (operation: "prepare" | "post" | "context") => void;
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
  if ((!postAsync && !post) || !getTournament || !getContext) return undefined;

  const startedAt = now();
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) return undefined;
  const lifetime = new AbortController();
  const attempted = new Set<string>();
  const listeners = new Set<() => void>();
  let candidate: RaceReceipt | undefined;
  let busy = false;
  let bestAttemptedScore = -1;
  let snapshot: FacebookSessionScoreSnapshot = {available: false, pending: false};
  const active = (locale: RaceLocale) => !lifetime.signal.aborted && isActive() && getLocale() === locale;
  const presentable = (locale: RaceLocale) => active(locale) && canPresent() &&
    (typeof document === "undefined" || document.visibilityState === "visible");
  const publishSnapshot = () => {
    const next = {available: Boolean(candidate && active(candidate.locale) && !attempted.has(candidate.runId)),
      pending: busy && !lifetime.signal.aborted && isActive()};
    if (snapshot.available === next.available && snapshot.pending === next.pending) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const report = (operation: "prepare" | "post" | "context") => {
    if (lifetime.signal.aborted || !isActive()) return;
    try {reportFailure(operation);} catch { /* Optional diagnostics cannot change a completed race. */ }
  };

  /** Explicit absence proves that session points cannot replace a native tournament time. */
  const outsideTournament = async (signal?: AbortSignal): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    const absence = getTournament().then(() => false, (error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "TOURNAMENT_NOT_FOUND") return true;
      throw error;
    });
    const deadline = new Promise<false>(resolve => {
      stop = () => resolve(false);
      lifetime.signal.addEventListener("abort", stop, {once: true});
      signal?.addEventListener("abort", stop, {once: true});
      timer = setTimeout(() => resolve(false), 8000);
    });
    try {return await Promise.race([absence, deadline]);}
    finally {
      if (timer !== undefined) clearTimeout(timer);
      if (stop) {
        lifetime.signal.removeEventListener("abort", stop);
        signal?.removeEventListener("abort", stop);
      }
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh: publishSnapshot,
    /** Records the opportunity only; completion never opens native UI or waits for an SDK promise. */
    record(runId: string, value: unknown): void {
      try {
        const receipt = parseFacebookTournamentRecordResponse(value), clock = now();
        if (receipt.runId !== runId || !active(receipt.locale) || receipt.completedAtMs < startedAt ||
          !Number.isSafeInteger(clock) || receipt.completedAtMs > clock || attempted.has(runId)) return;
        const score = sessionScore(receipt);
        if (score <= bestAttemptedScore || (candidate && score <= sessionScore(candidate))) return;
        candidate = receipt;
        publishSnapshot();
      } catch {report("prepare");}
    },
    /** A mounted, player-requested action owns any platform dialog or context change. */
    async publish(signal?: AbortSignal): Promise<PlatformResult<void>> {
      const receipt = candidate;
      if (busy || !receipt || !presentable(receipt.locale) || signal?.aborted) {
        return {status: "unavailable", message: "facebook-session-score-unavailable"};
      }
      const score = sessionScore(receipt);
      busy = true;
      publishSnapshot();
      try {
        return await runFacebookSdkDialog(sdk, async () => {
          const current = () => !signal?.aborted && candidate === receipt && presentable(receipt.locale);
          if (!current() || score <= bestAttemptedScore || attempted.has(receipt.runId)) return {status: "cancelled"};
          const context = getContext();
          if (!await outsideTournament(signal) || !current() || getContext() !== context) {
            return {status: "unavailable", message: "facebook-session-score-context-unavailable"};
          }
          // Mark before calling: an SDK rejection can follow a delivered side effect.
          attempted.add(receipt.runId);
          bestAttemptedScore = score;
          let posted = true;
          try {
            if (postAsync) await postAsync(score);
            else post?.(score);
          } catch {posted = false; report("post");}
          finally {
            // A rejected score can still have changed native context before its response was lost.
            if (!lifetime.signal.aborted && isActive()) {
              try {await synchronizeContext();} catch {report("context");}
            }
          }
          return posted ? {status: "success", value: undefined} :
            {status: "retryable-failure", message: "facebook-session-score-failed"};
        });
      } catch {
        report("prepare");
        return {status: "retryable-failure", message: "facebook-session-score-failed"};
      } finally {
        busy = false;
        publishSnapshot();
      }
    },
    retire() {
      lifetime.abort();
      busy = false;
      candidate = undefined;
      attempted.clear();
      publishSnapshot();
      listeners.clear();
    },
  };
}

export type FacebookSessionScore = NonNullable<ReturnType<typeof createFacebookSessionScore>>;
