import {describe, expect, it} from "@jest/globals";
import {
  auditLogToCsv,
  filterAndSortPlayers,
  filterRiddles,
  getManagementInsights,
  playersToCsv,
} from "../adminUtils";
import type {PortalOverview, PortalUser} from "../firebase";

const players: PortalUser[] = [
  {
    userId: "u1",
    username: "Ada",
    email: "ada@example.com",
    coins: 120,
    gamesPlayed: 10,
    wins: 8,
    winRate: 0.8,
    classicIndex: 12,
    preferredLanguage: "en",
    lastLogin: 2000,
  },
  {
    userId: "u2",
    username: "Mina",
    email: "mina@example.com",
    coins: 900,
    gamesPlayed: 12,
    wins: 4,
    winRate: 0.33,
    classicIndex: 4,
    preferredLanguage: "fr",
    lastLogin: 1000,
  },
];

describe("admin management utilities", () => {
  it("filters players by query and locale before sorting", () => {
    const result = filterAndSortPlayers(players, "example", "fr", "coins");

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("Mina");
  });

  it("sorts players by operational metrics", () => {
    expect(filterAndSortPlayers(players, "", "", "coins")[0].username).toBe("Mina");
    expect(filterAndSortPlayers(players, "", "", "wins")[0].username).toBe("Ada");
    expect(filterAndSortPlayers(players, "", "", "recent")[0].username).toBe("Ada");
  });

  it("filters riddles across text, answer, category, and locale", () => {
    const result = filterRiddles(
      [
        {
          riddleId: "r1",
          text: "I have keys but no locks",
          answer: "piano",
          locale: "en",
          category: "classic",
          index: 1,
          challengeKey: null,
        },
        {
          riddleId: "r2",
          text: "Je parle sans bouche",
          answer: "echo",
          locale: "fr",
          category: "daily",
          index: null,
          challengeKey: "2026-07-05",
        },
      ],
      "echo",
      "fr",
    );

    expect(result.map((riddle) => riddle.riddleId)).toEqual(["r2"]);
  });

  it("derives management insights from overview data", () => {
    const overview: PortalOverview = {
      generatedAt: 1,
      metrics: {
        userCount: 2,
        classicCount: 1,
        localizedRiddleCount: 22,
        healthyDailyLocales: 1,
        localeCount: 2,
      },
      users: players,
      riddles: [],
      localizedCounts: [
        {locale: "en", count: 20},
        {locale: "fr", count: 2},
      ],
      dailyByLocale: [
        {locale: "en", available: true, challengeKey: "today", text: "Ready"},
        {locale: "fr", available: false, challengeKey: null, text: null},
      ],
    };

    expect(getManagementInsights(overview)).toMatchObject({
      activeUsersLoaded: 2,
      missingDailyLocales: ["fr"],
      totalLoadedCoins: 1020,
    });
    expect(getManagementInsights(overview).lowInventoryLocales[0].locale).toBe("fr");
  });

  it("exports CSV with escaped values", () => {
    const csv = playersToCsv([{...players[0], username: 'Ada, "The Solver"'}]);

    expect(csv).toContain('"Ada, ""The Solver"""');
    expect(csv.split("\n")[0]).toContain("userId,username,email");
  });

  it("exports audit events to CSV", () => {
    const csv = auditLogToCsv([
      {
        auditId: "a1",
        action: "adjust-user-coins",
        adminUserId: "admin",
        targetUserId: "u1",
        delta: 50,
        previousBalance: 10,
        newBalance: 60,
        reason: "Support credit",
        createdAt: 1000,
      },
    ]);

    expect(csv).toContain("adjust-user-coins");
    expect(csv).toContain("Support credit");
  });
});
