import type {PortalAuditEvent, PortalOverview, PortalRiddle, PortalUser} from "./firebase";

export type PlayerSortKey = "recent" | "coins" | "wins" | "winRate";

const normalize = (value: string): string => value.trim().toLowerCase();

const compareNumberDescending = (left: number, right: number): number => right - left;

export function filterAndSortPlayers(
  players: PortalUser[],
  query: string,
  locale: string,
  sortKey: PlayerSortKey,
): PortalUser[] {
  const normalizedQuery = normalize(query);
  const normalizedLocale = normalize(locale);

  const filtered = players.filter((player) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [player.username, player.email, player.userId].some((value) => normalize(value).includes(normalizedQuery));
    const matchesLocale =
      normalizedLocale.length === 0 || normalize(player.preferredLanguage) === normalizedLocale;
    return matchesQuery && matchesLocale;
  });

  return [...filtered].sort((left, right) => {
    if (sortKey === "coins") return compareNumberDescending(left.coins, right.coins);
    if (sortKey === "wins") return compareNumberDescending(left.wins, right.wins);
    if (sortKey === "winRate") return compareNumberDescending(left.winRate, right.winRate);
    return compareNumberDescending(left.lastLogin ?? 0, right.lastLogin ?? 0);
  });
}

export function filterRiddles(riddles: PortalRiddle[], query: string, locale: string): PortalRiddle[] {
  const normalizedQuery = normalize(query);
  const normalizedLocale = normalize(locale);

  return riddles.filter((riddle) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [riddle.text, riddle.answer, riddle.category, riddle.riddleId].some((value) =>
        normalize(value).includes(normalizedQuery),
      );
    const matchesLocale = normalizedLocale.length === 0 || normalize(riddle.locale) === normalizedLocale;
    return matchesQuery && matchesLocale;
  });
}

export function getManagementInsights(data: PortalOverview) {
  const missingDailyLocales = data.dailyByLocale.filter((item) => !item.available).map((item) => item.locale);
  const lowInventoryLocales = [...data.localizedCounts].sort((left, right) => left.count - right.count).slice(0, 4);
  const totalLoadedCoins =
    data.metrics.totalCoinsLoaded ?? data.users.reduce((total, player) => total + player.coins, 0);
  const activeUsersLoaded =
    data.metrics.activeUsersLoaded ?? data.users.filter((player) => player.lastLogin !== null).length;
  const averageWinRate =
    data.users.length === 0
      ? 0
      : data.users.reduce((total, player) => total + player.winRate, 0) / data.users.length;

  return {
    activeUsersLoaded,
    averageWinRate,
    lowInventoryLocales,
    missingDailyLocales,
    totalLoadedCoins,
  };
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

export function playersToCsv(players: PortalUser[]): string {
  return toCsv(
    players.map((player) => ({
      userId: player.userId,
      username: player.username,
      email: player.email,
      preferredLanguage: player.preferredLanguage,
      coins: player.coins,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      winRate: player.winRate,
      classicIndex: player.classicIndex,
      lastLogin: player.lastLogin,
    })),
  );
}

export function riddlesToCsv(riddles: PortalRiddle[]): string {
  return toCsv(
    riddles.map((riddle) => ({
      riddleId: riddle.riddleId,
      locale: riddle.locale,
      category: riddle.category,
      index: riddle.index,
      challengeKey: riddle.challengeKey,
      text: riddle.text,
      answer: riddle.answer,
    })),
  );
}

export function auditLogToCsv(events: PortalAuditEvent[]): string {
  return toCsv(
    events.map((event) => ({
      auditId: event.auditId,
      action: event.action,
      adminUserId: event.adminUserId,
      targetUserId: event.targetUserId,
      delta: event.delta,
      previousBalance: event.previousBalance,
      newBalance: event.newBalance,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
  );
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
