import type {RaceMatchRequest, RaceMatchResponse} from "@qwordly/core/race";
import type {MatchmakingCapability} from "../platform/types";

/** Adapts authenticated recorded selection; native provider context selection remains a separate capability. */
export function createFirebaseRaceMatchmaking(
  lookup: (request: RaceMatchRequest) => Promise<RaceMatchResponse> = async (request) =>
    (await (await import("../firebase")).findRaceMatch(request)).data,
  options: {
    /** Owning target explicitly enables ticket-bound safety controls. */
    liveSafety?: boolean;
    /** Only the owning provider opts into the retained live-results surface. */
    liveHistory?: boolean;
    /** Only explicitly enabled targets may initiate a ticket-bound human rematch. */
    liveRematch?: boolean;
  } = {},
): MatchmakingCapability {
  return {
  live: {
    /** Loads receipt transport only for an eligible recovery, never during normal live play. */
    async confirmGuessReceipt(input) {
      /** Both the locator and private acknowledgement cross a strict shared contract. */
      const [{confirmLiveGuessReceipt}, {LiveGuessReceiptQuerySchema, LiveGuessReceiptResultSchema}] = await Promise.all([import("../firebase"), import("@qwordly/core/race")]);
      return LiveGuessReceiptResultSchema.parse((await confirmLiveGuessReceipt(LiveGuessReceiptQuerySchema.parse(input))).data);
    },
    ...(options.liveRematch ? {
      /** The existing authenticated join reserves the original private opponent server-side. */
      async rematch(input: Pick<import("@qwordly/core/race").JoinLiveRace, "locale" | "categoryId" | "requestId" | "retirementAware" | "expectedOwnerId"> & {
        /** Caller-owned terminal seat. */ rematchOfTicketId: string;
      }) {
        /** Untrusted callable replies pass the existing strict live projection schema. */
        const [{joinLiveRace}, {LiveRaceViewSchema}] = await Promise.all([import("../firebase"), import("@qwordly/core/race")]);
        return LiveRaceViewSchema.parse((await joinLiveRace(input)).data);
      },
    } : {}),
    ...(options.liveHistory ? {
      /** Lazy strict history remains outside startup and the default Jest surface. */
      async history(locale: import("@qwordly/core/race").RaceLocale) {
        /** One owning-target callable and shared public schema load together. */
        const [{listLiveRaceHistory}, {ListLiveRaceHistoryResponseSchema}] = await Promise.all([import("../firebase"), import("@qwordly/core/race")]);
        return ListLiveRaceHistoryResponseSchema.parse((await listLiveRaceHistory({locale, limit: 20})).data);
      },
    } : {}),
    ...(options.liveSafety ? {
      /** Existing callable resolves the private live opponent in its own mutation transaction. */
      async blockOpponent(input: {
        /** Caller-owned live seat. */
        liveTicketId: string;
      }) {
        /** Lazy strict response contract stays outside target startup. */
        const [{blockRival}, {BlockSocialRivalResponseSchema}] = await Promise.all([import("../firebase"), import("@qwordly/core/race")]);
        return BlockSocialRivalResponseSchema.parse((await blockRival(input)).data);
      },
      /** Report retries preserve the selected category, owned seat and request identity. */
      async reportOpponent(input: {
        /** Caller-owned live seat. */
        liveTicketId: string;
        /** Fixed reason. */
        category: import("@qwordly/core/race").SocialReportCategory;
        /** Retry identity. */
        requestId: string;
      }) {
        /** Only an exact queue acknowledgement reaches the shared UI. */
        const [{reportRival}, {ReportSocialRivalResponseSchema}] = await Promise.all([import("../firebase"), import("@qwordly/core/race")]);
        return ReportSocialRivalResponseSchema.parse((await reportRival(input)).data);
      },
    } : {}),
    /** Lazy target-owned listener releases its subscription even if loading finishes after retirement. */
    observe(ticketId, onChange, onStatus) {
      /** Protects asynchronous SDK loading and queued listener callbacks after cleanup. */
      let active = true, unsubscribe: (() => void) | undefined;
      onStatus(false);
      void import("./firebaseLiveRaceSignals").then(({observeFirebaseLiveRace}) => {
        if (active) unsubscribe = observeFirebaseLiveRace(ticketId,
          () => {if (active) onChange();}, connected => {if (active) onStatus(connected);});
      }).catch(() => {if (active) onStatus(false);});
      return () => {active = false; unsubscribe?.();};
    },
    /** Persists an addressed invitation with one durable notification receipt. */
    async sendChallenge(input) {return (await (await import("../firebase")).sendLiveRaceChallenge(input)).data;},
    /** Loads the authenticated recipient's direct invitation notices. */
    async inbox() {return (await (await import("../firebase")).listLiveRaceChallenges({})).data;},
    /** Validates an SDK invitation before showing the acceptance action. */
    async challenge(input) {return (await (await import("../firebase")).getLiveRaceChallenge(input)).data;},
    /** Provides join behavior. */
    async join(input) {return (await (await import("../firebase")).joinLiveRace(input)).data;},
    /** Background retirement remains authenticated under the original join intent. */
    async retireJoin(input) {return (await (await import("../firebase")).retireLiveRaceJoin(input)).data;},
    /** Provides update behavior. */
    async update(input) {return (await (await import("../firebase")).updateLiveRace(input)).data;},
  },
  /** Finds an authenticated recorded opponent. */
  async find(input) {
    try {
      /** Load validation alongside the request without adding it to game startup. */
      const [response, {RaceMatchResponseSchema}] = await Promise.all([
        lookup(typeof input === "string" ? {locale: input} : input),
        import("@qwordly/core/race"),
      ]);
      return {status: "success", value: RaceMatchResponseSchema.parse(response)};
    } catch (error) {
      /** Failure schemas load with matchmaking rather than entering target startup resources. */
      const {raceMatchmakingFailureResult} = await import("../platform/raceMatchmakingFailure");
      return raceMatchmakingFailureResult(error);
    }
  }};
}
