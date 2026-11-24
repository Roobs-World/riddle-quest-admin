import {trackEvent} from "../../observability/analytics/eventsRuntime";
import type {LiveRaceCapability, LiveRaceView} from "../contracts/index";

/** Records accepted live actions while leaving provider authority and retry identities intact. */
export function withLiveRaceAnalytics(provider: LiveRaceCapability, isActive: () => boolean): LiveRaceCapability {
  const rematch = provider.rematch?.bind(provider);
  const retireJoin = provider.retireJoin?.bind(provider);
  const confirmGuessReceipt = provider.confirmGuessReceipt?.bind(provider);
  const observe = provider.observe?.bind(provider);
  const challenge = provider.challenge?.bind(provider);
  const inbox = provider.inbox?.bind(provider);
  const history = provider.history?.bind(provider);
  const sendChallenge = provider.sendChallenge?.bind(provider);
  const shareChallenge = provider.shareChallenge?.bind(provider);
  const chooseChallenge = provider.chooseChallenge?.bind(provider);
  const blockOpponent = provider.blockOpponent?.bind(provider);
  const reportOpponent = provider.reportOpponent?.bind(provider);
  /** Private receipt identities suppress retries without becoming analytics dimensions. */
  const consumed = new Set<string>();
  /** Observations share phase history with command responses to avoid poll-generated duplicates. */
  const phases = new Map<string, LiveRaceView["phase"]>();
  const emit = (event: string, key: string, params: Parameters<typeof trackEvent>[1] = {}) => {
    if (!isActive() || consumed.has(key)) return;
    consumed.add(key);
    trackEvent(event, params);
  };
  const observeView = (view: LiveRaceView): LiveRaceView => {
    const accepted = view;
    if (!isActive()) return accepted;
    if (phases.get(accepted.ticketId) !== accepted.phase) {
      phases.set(accepted.ticketId, accepted.phase);
      trackEvent("live_race_phase_changed", {phase: accepted.phase});
    }
    if (accepted.phase === "racing") emit("live_race_started", `start:${accepted.ticketId}`, {
      kind: accepted.challengeId ? "private" : "public", opponent_kind: accepted.opponent?.bot ? "bot" : "human",
    });
    if (accepted.phase === "result") {
      emit("live_race_completed", `result:${accepted.ticketId}`, {
        result: accepted.result ?? "unknown", correct_count: accepted.player.correctCount,
        opponent_kind: accepted.opponent?.bot ? "bot" : "human", reward_coins: accepted.rewardCoins,
      });
      if (accepted.rewardCoins > 0) emit("earn_virtual_currency", `reward:${accepted.ticketId}`, {
        virtual_currency_name: "coins", value: accepted.rewardCoins, source: "live_race",
      });
    }
    return accepted;
  };
  const perform = async <Result>(action: string, operation: () => Promise<Result>): Promise<Result> => {
    try {return await operation();} catch (error) {
      if (action !== "poll" && isActive()) trackEvent("action_failed", {action: `live_race_${action}`});
      throw error;
    }
  };
  return {
    ...provider,
    join: async input => {
      const view = observeView(await perform("join", () => provider.join(input)));
      emit("live_race_joined", `join:${input.requestId}`, {
        category_id: input.categoryId, locale: input.locale,
        kind: input.challengeId || input.createChallenge ? "private" : "public",
        resumed: Boolean(input.resumeTicketId),
      });
      return view;
    },
    update: async input => {
      const view = observeView(await perform(input.action, () => provider.update(input)));
      if (input.action !== "poll") emit(`live_race_${input.action}_confirmed`, `action:${input.requestId}`, {
        phase: view.phase, correct_count: view.player.correctCount,
      });
      return view;
    },
    ...(rematch ? {rematch: async (input: Parameters<NonNullable<LiveRaceCapability["rematch"]>>[0]) => {
      const result = observeView(await perform("rematch", () => rematch(input)));
      emit("live_race_rematch_created", `rematch:${input.requestId}`, {category_id: input.categoryId, locale: input.locale});
      return result;
    }} : {}),
    ...(retireJoin ? {retireJoin: (input: Parameters<NonNullable<LiveRaceCapability["retireJoin"]>>[0]) => retireJoin(input)} : {}),
    ...(confirmGuessReceipt ? {confirmGuessReceipt: async (input: Parameters<NonNullable<LiveRaceCapability["confirmGuessReceipt"]>>[0]) => {
      const result = await confirmGuessReceipt(input);
      if (result.status === "accepted") emit("live_race_guess_confirmed", `action:${input.requestId}`, {
        success: false, receipt_recovered: true,
      });
      return result;
    }} : {}),
    ...(observe ? {observe: (...input: Parameters<NonNullable<LiveRaceCapability["observe"]>>) => observe(...input)} : {}),
    ...(challenge ? {challenge: (input: Parameters<NonNullable<LiveRaceCapability["challenge"]>>[0]) => challenge(input)} : {}),
    ...(inbox ? {inbox: async () => {
      const result = await inbox();
      emit("live_race_inbox_viewed", "inbox", {result_count: result.length});
      return result;
    }} : {}),
    ...(history ? {history: async (locale: Parameters<NonNullable<LiveRaceCapability["history"]>>[0]) => {
      const result = await history(locale);
      if (isActive()) trackEvent("live_race_history_viewed", {locale});
      return result;
    }} : {}),
    ...(sendChallenge ? {sendChallenge: async (input: Parameters<NonNullable<LiveRaceCapability["sendChallenge"]>>[0]) => {
      const result = await sendChallenge(input);
      if (isActive()) trackEvent("live_race_invitation_sent", {status: result.status});
      return result;
    }} : {}),
    ...(shareChallenge ? {shareChallenge: async (input: Parameters<NonNullable<LiveRaceCapability["shareChallenge"]>>[0]) => {
      if (isActive()) trackEvent("live_race_share_requested");
      const status = await shareChallenge(input);
      if (isActive()) trackEvent("live_race_share_result", {status});
      return status;
    }} : {}),
    ...(chooseChallenge ? {chooseChallenge: async () => {
      if (isActive()) trackEvent("live_race_audience_requested");
      const result = await chooseChallenge();
      if (isActive()) trackEvent("live_race_audience_result", {status: result.status});
      return result.status === "success" ? {...result, value: withLiveRaceAnalytics(result.value, isActive)} : result;
    }} : {}),
    ...(blockOpponent ? {blockOpponent: async (input: Parameters<NonNullable<LiveRaceCapability["blockOpponent"]>>[0]) => {
      const result = await blockOpponent(input);
      if (isActive()) trackEvent("live_race_opponent_blocked");
      return result;
    }} : {}),
    ...(reportOpponent ? {reportOpponent: async (input: Parameters<NonNullable<LiveRaceCapability["reportOpponent"]>>[0]) => {
      const result = await reportOpponent(input);
      emit("live_race_opponent_reported", `report:${input.requestId}`, {category: input.category});
      return result;
    }} : {}),
  };
}
