/** Standard number of players displayed on one leaderboard page. */
export const LEADERBOARD_PAGE_SIZE = 10;

/** Derived pagination values used by the leaderboard modal. */
export type LeaderboardPage<Entry> = {
  /** Valid zero-based page selected for rendering. */
  activePage: number;
  /** Total number of pages, including the empty first page. */
  pageCount: number;
  /** Zero-based source index of the first visible entry. */
  pageStart: number;
  /** Entries displayed on the active page. */
  visibleEntries: Entry[];
};

/** Clamps a requested page and returns its visible leaderboard slice. */
export const paginateLeaderboard = <Entry>(
  entries: readonly Entry[],
  requestedPage: number,
  pageSize = LEADERBOARD_PAGE_SIZE,
): LeaderboardPage<Entry> => {
  /** Positive page size used to avoid invalid division and slicing. */
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  /** Page count derived directly from the current entries. */
  const pageCount = Math.max(1, Math.ceil(entries.length / safePageSize));
  /** Requested page clamped to the available range. */
  const activePage = Math.min(pageCount - 1, Math.max(0, Math.trunc(requestedPage)));
  /** First source index included on the active page. */
  const pageStart = activePage * safePageSize;

  return {
    activePage,
    pageCount,
    pageStart,
    visibleEntries: entries.slice(pageStart, pageStart + safePageSize),
  };
};
