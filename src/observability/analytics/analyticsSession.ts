import {sanitizeAnalyticsParams, type AnalyticsParams, type AnalyticsSink, type SanitizedAnalyticsParams} from "./eventsRuntime";

type CheckpointReason = "interval" | "background" | "pagehide" | "dispose";
type Round = {kind: "observed"; started: number; attempts: number; hints: number; continues: number; resumed: boolean}
  | {kind: "ambiguous"};
const emptyCounts = () => ({
  screen_views: 0, levels_started: 0, levels_completed: 0, correct_attempts: 0, incorrect_attempts: 0,
  hints_used: 0, continues_used: 0, skips_used: 0, races_started: 0, races_completed: 0,
  checkouts_started: 0, purchase_confirmations: 0, operation_failures: 0,
});

/** A consent-owned observation window. It creates no persistent player or session identifier. */
export function createAnalyticsSession({send, now, context = {}, foreground = true, initialScreen = ""}: {
  send: AnalyticsSink;
  now: () => number;
  context?: AnalyticsParams;
  foreground?: boolean;
  initialScreen?: string;
}) {
  let disposed = false;
  let visible = foreground;
  let lastTick = now();
  let foregroundMs = 0;
  let lastSummary = 0;
  let screenStarted = 0;
  let screen = initialScreen;
  let screenContext: SanitizedAnalyticsParams = {};
  let counts = emptyCounts();
  let raceStarted: number | null = null;
  const rounds = new Map<string, Round>();
  const receipts = new Set<string>();
  const metadata = sanitizeAnalyticsParams(context);
  const clock = () => {
    const tick = now();
    if (visible && Number.isFinite(tick) && Number.isFinite(lastTick)) foregroundMs += Math.max(0, tick - lastTick);
    lastTick = tick;
    return foregroundMs;
  };
  const emit = (name: string, params: AnalyticsParams = {}) => {
    if (disposed) return;
    try {void Promise.resolve(send(name, sanitizeAnalyticsParams({...metadata, ...params}))).catch(() => {});} catch { /* Optional delivery never changes play. */ }
  };
  const reportScreen = (reason: string) => {
    const duration = Math.round(clock() - screenStarted);
    if (screen && duration > 0) emit("game_screen_engagement", {...screenContext, screen_name: screen, foreground_ms: duration, reason});
    screenStarted = foregroundMs;
  };
  const checkpoint = (reason: CheckpointReason) => {
    if (disposed || reason === "dispose" || reason === "interval" && !visible) return;
    const duration = Math.round(clock() - lastSummary);
    if (duration <= 0 && Object.values(counts).every(value => value === 0)) return;
    reportScreen(reason);
    emit("game_session_summary", {foreground_ms: duration, ...counts, reason});
    counts = emptyCounts();
    lastSummary = foregroundMs;
  };
  const modeOf = (params: SanitizedAnalyticsParams) =>
    params.game_mode === "classic" || params.game_mode === "challenge" ? params.game_mode : null;
  const elapsed = (round: Round | undefined, time: number): AnalyticsParams => round?.kind === "observed"
    ? {foreground_ms: Math.round(time - round.started), observed_attempts: round.attempts,
      observed_hints: round.hints, observed_continues: round.continues, resumed: round.resumed,
      timing_scope: round.resumed ? "resumed" : "observed_start"}
    : {timing_scope: round ? "ambiguous" : "unobserved"};
  const finishRound = (mode: string, round: Round | undefined) => {
    // Without private receipt identities, later out-of-order completions cannot prove correlation.
    if (round?.kind !== "ambiguous") rounds.delete(mode);
  };
  const record: AnalyticsSink = (name, params) => {
    if (disposed) return;
    const time = clock();
    const mode = modeOf(params);
    const round = mode ? rounds.get(mode) : undefined;
    let enriched = params;
    switch (name) {
      case "screen_view": {
        const next = typeof params.screen_name === "string" ? params.screen_name : "";
        if (next && next !== screen) {reportScreen("screen_changed"); screen = next;}
        const raceScreen = next === "multiplayer" || next.startsWith("multiplayer_");
        if (raceScreen) enriched = {...params, game_mode: "race"};
        screenContext = sanitizeAnalyticsParams({game_mode: raceScreen ? "race" : typeof params.game_mode === "string" ? params.game_mode : undefined,
          play_surface: typeof params.play_surface === "string" ? params.play_surface : typeof metadata.play_surface === "string" ? metadata.play_surface : undefined});
        counts.screen_views += 1;
        break;
      }
      case "level_start":
        counts.levels_started += 1;
        if (mode) {
          if (round) {
            if (round.kind === "observed") emit("level_replaced", {game_mode: mode, ...elapsed(round, time)});
            rounds.set(mode, {kind: "ambiguous"});
          } else rounds.set(mode, {kind: "observed", started: time, attempts: 0, hints: 0, continues: 0, resumed: params.resumed === true || params.resumed === 1});
        }
        break;
      case "level_resumed":
        if (mode && !round) rounds.set(mode, {kind: "observed", started: time, attempts: 0, hints: 0, continues: 0, resumed: true});
        break;
      case "guess_submitted":
        if (params.success === true || params.success === 1) counts.correct_attempts += 1;
        else counts.incorrect_attempts += 1;
        if (round?.kind === "observed") round.attempts += 1;
        break;
      case "hint_used": counts.hints_used += 1; if (round?.kind === "observed") round.hints += 1; break;
      case "continue_used": counts.continues_used += 1; if (round?.kind === "observed") round.continues += 1; break;
      case "riddle_skipped":
        counts.skips_used += 1;
        enriched = sanitizeAnalyticsParams({...params, ...elapsed(round, time)});
        if (mode) finishRound(mode, round);
        break;
      case "level_end":
        counts.levels_completed += 1;
        if (params.result !== "skip") {
          enriched = sanitizeAnalyticsParams({...params, ...elapsed(round, time)});
          if (mode) finishRound(mode, round);
        }
        break;
      case "live_race_started": counts.races_started += 1; raceStarted = time; break;
      case "live_race_completed":
        counts.races_completed += 1;
        if (raceStarted !== null) enriched = {...params, foreground_ms: Math.round(time - raceStarted)};
        raceStarted = null;
        break;
      case "begin_checkout": case "checkout_requested": counts.checkouts_started += 1; break;
      case "purchase": case "purchase_confirmed": {
        const receipt = typeof params.transaction_id === "string" && params.transaction_id ? params.transaction_id : null;
        if (!receipt || !receipts.has(receipt)) counts.purchase_confirmations += 1;
        if (receipt) receipts.add(receipt);
        break;
      }
      case "checkout_result":
        if (params.status === "coins" || params.status === "premium") counts.purchase_confirmations += 1;
        break;
      case "action_failed": case "operation_error": case "game_action_failed": case "game_load_failed": counts.operation_failures += 1; break;
    }
    emit(name, enriched);
  };
  emit("game_session_started", {foreground});
  return {
    record,
    checkpoint,
    setForeground(next: boolean) {
      if (disposed || next === visible) return;
      if (!next) checkpoint("background");
      clock();
      visible = next;
      if (next) emit("game_session_resumed");
    },
    /** Revocation discards the unfinished segment without sending a final event. */
    dispose() {disposed = true; rounds.clear(); receipts.clear();},
  };
}
