import {
  LiveRaceChallengeSchema, LiveRaceViewSchema, RetireLiveRaceJoinResponseSchema,
  LiveGuessReceiptResultSchema, ListLiveRaceHistoryResponseSchema,
  BlockSocialRivalResponseSchema, ReportSocialRivalResponseSchema,
  SendLiveRaceChallengeResponseSchema, type LiveRaceCapability,
} from "../contracts/index";
import type {GameFunctionsClient} from "../../platform/firebase/gameFunctions";

/** Creates a strict live transport over the account's authenticated game callables. */
export function createFirebaseLiveTransport(functions: GameFunctionsClient): LiveRaceCapability {
  return {
    join: async input => LiveRaceViewSchema.parse((await functions.joinLiveRace(input)).data),
    update: async input => LiveRaceViewSchema.parse((await functions.updateLiveRace(input)).data),
    retireJoin: async input => RetireLiveRaceJoinResponseSchema.parse((await functions.retireLiveRaceJoin(input)).data),
    confirmGuessReceipt: async input => LiveGuessReceiptResultSchema.parse((await functions.confirmLiveGuessReceipt(input)).data),
    challenge: async input => LiveRaceChallengeSchema.parse((await functions.getLiveRaceChallenge(input)).data),
    inbox: async () => (await functions.listLiveRaceChallenges({})).data.map(value => LiveRaceChallengeSchema.parse(value)),
    sendChallenge: async input => SendLiveRaceChallengeResponseSchema.parse((await functions.sendLiveRaceChallenge(input)).data),
    history: async locale => ListLiveRaceHistoryResponseSchema.parse((await functions.listLiveRaceHistory({locale, limit: 20})).data),
    rematch: async input => LiveRaceViewSchema.parse((await functions.joinLiveRace(input)).data),
    blockOpponent: async input => BlockSocialRivalResponseSchema.parse((await functions.blockRival(input)).data),
    reportOpponent: async input => ReportSocialRivalResponseSchema.parse((await functions.reportRival(input)).data),
  };
}
