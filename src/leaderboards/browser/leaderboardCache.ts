import type {BridgeLeaderboardEntry} from "../../platform/bridge/messages";
import type {LeaderboardType} from "../../platform/contracts/requestSchemas";

export const LEADERBOARD_CACHE_TTL_MS = 60_000;

export type CachedLeaderboardPage = {
  entries: BridgeLeaderboardEntry[];
  nextCursor: string | null;
  loadedAt: number;
};

export type LeaderboardCache = Partial<Record<LeaderboardType, Partial<Record<number, CachedLeaderboardPage>>>>;

export function getFreshLeaderboardPage(cache: LeaderboardCache, type: LeaderboardType, page: number, now = Date.now()) {
  const cached = cache[type]?.[page];
  return cached && now - cached.loadedAt < LEADERBOARD_CACHE_TTL_MS ? cached : undefined;
}

export function cacheLeaderboardPage(cache: LeaderboardCache, type: LeaderboardType, page: number, result: CachedLeaderboardPage): LeaderboardCache {
  const pages: Partial<Record<number, CachedLeaderboardPage>> = {};
  for (const [index, cached] of Object.entries(cache[type] ?? {})) {
    if (Number(index) < page) pages[Number(index)] = cached;
  }
  pages[page] = result;
  return {...cache, [type]: pages};
}
