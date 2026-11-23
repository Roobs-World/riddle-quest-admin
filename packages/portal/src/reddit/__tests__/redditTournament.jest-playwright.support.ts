import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";
import {LiveRaceViewSchema, RACE_RULES} from "@riddle-quest/core/race";

/** Restores the game-owned Reddit board through the shipped same-origin adapter. */
export async function verifyRedditTournamentBoard(page: Page) {
  /** Route observations must never become race or currency mutations. */
  const reads: Array<{
    /** Same-origin board request URL. */ url: string;
    /** Requested content language. */ locale: string;
  }> = [];
  /** First read failure exercises the visible retry boundary. */
  let fail = true;
  await page.route("**/api/game/tournament.list", async route => {
    /** Content locale comes from the real Reddit request. */
    const {locale} = route.request().postDataJSON();
    reads.push({url: route.request().url(), locale});
    if (fail) {fail = false; return route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({error: "unavailable"})});}
    /** Exact UTC window contains only identity-free official standings. */
    const startsAtMs = Math.floor(Date.now() / 86400000) * 86400000;
    /** Current-player best is a confirmed server result, never a caller-nominated value. */
    const currentPlayer = {rank: 1, adjustedTimeMs: 9000, isCurrentPlayer: true};
    return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {
      tournamentId: `reddit-race10-${locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`, locale,
      startsAtMs, endsAtMs: startsAtMs + 86400000, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
      standings: [currentPlayer], currentPlayer,
    }})});
  });
  try {
    await page.locator(".multiplayer-navigation-action").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.locator('.race-hub-tabs [role="tab"]').last().click({timeout: 5000});
    await page.locator('[data-analytics-screen="reddit_tournament"]').waitFor();
    await page.locator(".race-error").waitFor();
    await page.locator(".race-error button").click();
    await page.locator('.race-tournaments li[aria-current="true"]').waitFor();
    expect(await page.locator(".race-tournaments li").innerText()).toContain("#1");
    expect(await page.locator(".race-tournaments button").count()).toBe(0);
    expect(await page.locator(".race-tournaments").getAttribute("data-rewards-enabled")).toBe("false");
    expect(reads.length).toBe(2);
    expect(reads.every(read => read.locale === "ar" && new URL(read.url).origin === new URL(page.url()).origin)).toBe(true);
    for (const width of [390, 1280]) {
      await page.setViewportSize({width, height: 844});
      /** Mobile and desktop board remain inside the modal viewport. */
      const bounds = await page.locator(".race-screen").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
    await page.locator('.race-hub-tabs [role="tab"]').first().focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.locator(".race-close").click();
    await page.locator(".race-screen").waitFor({state: "detached"});
  } finally {
    await page.unroute("**/api/game/tournament.list");
    await page.setViewportSize({width: 390, height: 844});
  }
}

/** Eligible live victories use the shipped Reddit recorder without caller-provided scores. */
export async function verifyRedditTournamentLiveResult(page: Page) {
  /** Real browser requests retain only the opaque run and content locale. */
  const records: Array<{
    /** Same-origin recorder URL. */ url: string;
    /** Bounded opaque ticket request. */ input: unknown;
  }> = [];
  /** Public result variants exercise eligibility without fabricating private server authority. */
  let outcome: "win" | "loss" | "tie" = "loss", solves = 9;
  await page.route("**/api/game/tournament.record", async route => {
    /** Server-confirmed record echoes the bounded adapter request. */
    const input = route.request().postDataJSON();
    records.push({url: route.request().url(), input});
    /** The official recorder owns timing and the finish-day tournament. */
    const completedAtMs = Date.now();
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {
      tournamentId: `reddit-race10-${input.locale}-${new Date(completedAtMs).toISOString().slice(0, 10)}`,
      locale: input.locale, runId: input.runId, adjustedTimeMs: 2500, completedAtMs,
      improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
    }})});
  });
  await page.route("**/api/game/race.live.join", async route => {
    /** Real category and locale selections traverse the provider adapter. */
    const {locale, categoryId} = route.request().postDataJSON();
    /** Synthetic completed public view has no authority to award currency. */
    const serverNowMs = Date.now(), startsAtMs = serverNowMs - 2500;
    /** Strict production schema validates this injected response. */
    const result = LiveRaceViewSchema.parse({ticketId: "d".repeat(64), phase: "result", serverNowMs, startsAtMs,
      searchEndsAtMs: serverNowMs + 60000,
      player: {displayName: "RedditSolver", avatarUrl: null, bot: false, correctCount: solves},
      opponent: {displayName: "LiveRival", avatarUrl: null, bot: false, correctCount: 0},
      run: {runId: "d".repeat(64), role: "creator", status: "completed", categoryId, locale, rules: RACE_RULES,
        correctCount: solves, wallElapsedMs: 2500, totalPenaltyMs: 0, adjustedElapsedMs: 2500, currentRiddle: null, events: []},
      result: outcome, rewardCoins: 0,
    });
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result})});
  });
  try {
    await page.locator(".multiplayer-navigation-action").click();
    for (const variant of [{result: "loss", count: 9}, {result: "tie", count: 10},
      {result: "win", count: 9}, {result: "win", count: 10}] as const) {
      outcome = variant.result; solves = variant.count;
      /** Only the full victory can produce a recorder request. */
      const confirmation = outcome === "win" && solves === 10 ? page.waitForResponse("**/api/game/tournament.record") : undefined;
      await page.locator(".live-race-start").click();
      await page.locator(".live-race-victory").waitFor();
      await confirmation;
      expect(records).toHaveLength(confirmation ? 1 : 0);
      await page.locator(".race-close").click();
      await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    }
    expect(records[0].input).toEqual({runId: "d".repeat(64), locale: "ar"});
    expect(new URL(records[0].url).origin).toBe(new URL(page.url()).origin);
    expect(await page.locator(".race-error").count()).toBe(0);
    await page.locator(".race-close").click();
    await page.locator(".race-screen").waitFor({state: "detached"});
  } finally {
    await page.unroute("**/api/game/tournament.record");
    await page.unroute("**/api/game/race.live.join");
  }
}
