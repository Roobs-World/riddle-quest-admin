import {LIVE_RACE_HISTORY_MS, ListLiveRaceHistoryRequestSchema, ListLiveRaceHistoryResponseSchema} from "../raceLiveHistorySchemas";

/** Synthetic public projection contains no private source or account identifiers. */
const fixture = () => ({locale: "en", serverNowMs: 1_800_000_000_000, entries: [{ticketId: "a".repeat(64), categoryId: "history",
  createdAtMs: 1_799_999_999_000, result: "win", correctCount: 0, rewardCoins: 50, opponentAvailable: true,
  opponent: {displayName: "Game rival", avatarUrl: null, level: 1, correctCount: 2, bot: false}}]});
it("accepts observed forfeit rewards without inventing a ten-solve win", () => {
  expect(ListLiveRaceHistoryResponseSchema.parse(fixture()).entries[0]).toMatchObject({correctCount: 0, rewardCoins: 50});
  expect(ListLiveRaceHistoryRequestSchema.parse({locale: "en"})).toEqual({locale: "en", limit: 20});
});
it.each(["private", "duplicate", "future", "expired", "order", "loss-reward", "bot-target"])("rejects %s result projections", kind => {
  /** Independent fresh response is changed only for the tested violation. */
  const value = fixture();
  if (kind === "private") Reflect.set(value.entries[0], "targetUserId", "private-account");
  if (kind === "duplicate") value.entries.push({...value.entries[0]});
  if (kind === "future") value.entries[0].createdAtMs = value.serverNowMs + 1;
  if (kind === "expired") value.entries[0].createdAtMs = value.serverNowMs - LIVE_RACE_HISTORY_MS - 1;
  if (kind === "order") value.entries.push({...value.entries[0], ticketId: "b".repeat(64), createdAtMs: value.serverNowMs});
  if (kind === "loss-reward") value.entries[0].result = "loss";
  if (kind === "bot-target") value.entries[0].opponent.bot = true;
  expect(ListLiveRaceHistoryResponseSchema.safeParse(value).success).toBe(false);
});
it.each([{locale: "en", userId: "other"}, {locale: "en", limit: 21}, {locale: "en", limit: 0}])("rejects unsafe history request %p", value => {
  expect(ListLiveRaceHistoryRequestSchema.safeParse(value).success).toBe(false);
});
