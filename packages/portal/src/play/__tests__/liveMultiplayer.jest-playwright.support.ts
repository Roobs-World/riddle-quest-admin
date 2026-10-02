import {expect} from "@jest/globals";
import type {Page, Route} from "@playwright/test";
import {LiveRaceViewSchema, RACE_RULES, type JoinLiveRace, type UpdateLiveRace, type LiveRaceView} from "@qwordly/core/race";

/** Exercises the shipped platform adapter and live intro instead of the retired recorded hub. */
export async function installLiveMultiplayerJourney(page: Page, target: "Facebook" | "Reddit") {
  /** Captured authoritative join intents distinguish recovery from a new search. */
  const joins: JoinLiveRace[] = [];
  /** Seat commands verify polling and explicit retirement at the platform boundary. */
  const updates: UpdateLiveRace[] = [];
  /** Safety requests contain the owned seat, never a rival identity. */
  const reports: unknown[] = [], blocks: unknown[] = [];
  /** Live requests must preserve Reddit's same-origin boundary. */
  const requestUrls: string[] = [];
  /** One transient poll failure exercises recovery after the join has succeeded. */
  let failPoll = false;
  /** Matching is controlled independently of the browser's countdown clock. */
  let startsAtMs: number | null = null;
  /** The fixture grants no coins while searching or cancelling a lobby. */
  const snapshot = (): LiveRaceView => LiveRaceViewSchema.parse({
    ticketId: "b".repeat(64), phase: startsAtMs === null ? "searching" : "countdown",
    serverNowMs: Date.now(), searchEndsAtMs: Date.now() + 60_000, startsAtMs,
    player: {displayName: `${target}Solver`, avatarUrl: null, bot: false, correctCount: 0},
    opponent: startsAtMs === null ? null : {displayName: "LiveRival", avatarUrl: null, bot: false, correctCount: 0},
    run: null, result: null, rewardCoins: 0,
  });
  /** Preserves each platform's production response envelope. */
  const reply = (route: Route, result: unknown) => route.fulfill({status: 200, contentType: "application/json",
    body: JSON.stringify(target === "Reddit" ? {ok: true, result} : {data: result})});
  /** Provider diagnostics must never be copied into the rendered retry message. */
  const unavailable = (route: Route) => route.fulfill({status: 503, contentType: "application/json",
    body: JSON.stringify({error: target === "Reddit" ? "private provider diagnostic" :
      {status: "UNAVAILABLE", message: "private provider diagnostic"}})});
  await page.route(target === "Reddit" ? "**/api/game/race.categories" : "**/listRaceCategories", route => {
    return reply(route, {rules: RACE_RULES, categories: [
      {categoryId: "mixed", nameKey: "RaceTo10.CATEGORY_MIXED_NAME", descriptionKey: "RaceTo10.CATEGORY_MIXED_DESCRIPTION",
        icon: "shuffle", colorToken: "#6875F5", availableRiddleCount: 30},
    ]});
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.join" : "**/joinLiveRace", route => {
    /** Read the payload actually produced by the target adapter. */
    const input = route.request().postDataJSON();
    requestUrls.push(route.request().url());
    joins.push(target === "Reddit" ? input : input.data);
    return joins.length === 1 ? unavailable(route) : reply(route, snapshot());
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.update" : "**/updateLiveRace", route => {
    /** Player commands contain only an owned ticket, action and request identifier. */
    const input = route.request().postDataJSON();
    requestUrls.push(route.request().url());
    updates.push(target === "Reddit" ? input : input.data);
    if (failPoll && updates.at(-1)?.action === "poll") {failPoll = false; return unavailable(route);}
    return reply(route, updates.at(-1)?.action === "leave" ? {...snapshot(), phase: "cancelled"} : snapshot());
  });
  await page.route(target === "Reddit" ? "**/api/game/safety.report" : "**/reportRival", route => {
    /** Capture the actual target transport and its retry binding. */
    const raw = route.request().postDataJSON();
    reports.push(target === "Reddit" ? raw : raw.data); requestUrls.push(route.request().url());
    return reports.length === 1 ? unavailable(route) : reply(route, {reportId: "c".repeat(64), queued: true});
  });
  await page.route(target === "Reddit" ? "**/api/game/safety.block" : "**/blockRival", route => {
    /** The block endpoint resolves the paired rival exclusively on the server. */
    const raw = route.request().postDataJSON();
    blocks.push(target === "Reddit" ? raw : raw.data); requestUrls.push(route.request().url());
    return reply(route, {blocked: true});
  });
  return async (locale: string) => {
    await page.locator(".multiplayer-navigation-action").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.waitForFunction(() => (document.querySelector(".live-race-start") as HTMLButtonElement | null)?.disabled === false);
    expect(await page.locator('.race-category-grid [aria-pressed="true"]').count()).toBe(1);
    expect(await page.locator(".race-screen").getAttribute("role")).toBe("dialog");
    await page.locator(".live-race-start").click();
    await page.locator(".race-error").waitFor();
    expect(await page.locator(".race-error").innerText()).not.toContain("private provider diagnostic");
    await page.locator(".race-error button").click();
    await page.locator(".live-race-self").getByText(`${target}Solver`, {exact: true}).waitFor();
    expect(joins).toHaveLength(2);
    expect(joins[1]).toEqual(joins[0]);
    expect(joins[0]).toMatchObject({locale, categoryId: "mixed"});
    failPoll = true;
    await page.locator(".race-error").waitFor();
    await page.locator(".race-error button").click();
    await page.locator(".race-error").waitFor({state: "detached"});
    expect(joins).toHaveLength(2);
    startsAtMs = Date.now() + 5_000;
    await page.locator('[data-analytics-screen="multiplayer_live_countdown"]').waitFor();
    await page.locator(".live-race-rival").getByText("LiveRival", {exact: true}).waitFor();
    expect(Number(await page.locator(".live-race-countdown").innerText())).toBeGreaterThan(0);
    expect(Number(await page.locator(".live-race-countdown").innerText())).toBeLessThanOrEqual(5);
    // Hold the matched fixture while testing safety so viewport assertions do not race the countdown.
    startsAtMs = Date.now() + 30_000;
    await page.waitForFunction(() => Number(document.querySelector(".live-race-countdown")?.textContent) > 5);
    await page.locator(".live-race-safety summary").waitFor({timeout: 4000});
    await page.locator(".live-race-safety summary").click();
    expect(await page.locator(".live-race-safety option").count()).toBe(5);
    await page.locator(".live-race-safety select").selectOption("spam");
    await page.locator(".live-race-report").evaluate((button: HTMLElement) => {button.click(); button.click();});
    await page.locator(".live-race-safety .race-error").waitFor();
    expect(reports).toHaveLength(1);
    expect(await page.locator(".live-race-safety .race-error").innerText()).not.toContain("private provider diagnostic");
    await page.locator(".live-race-safety .race-error button").click();
    await page.locator(".live-race-safety [role=status]").waitFor();
    expect(reports).toHaveLength(2); expect(reports[1]).toEqual(reports[0]);
    expect(reports[0]).toEqual({liveTicketId: "b".repeat(64), category: "spam", requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,160}$/)});

    for (const width of [390, 1280]) {
      await page.setViewportSize({width, height: 844});
      /** The actual live surface must fit the mobile and desktop viewport. */
      const bounds = await page.locator(".race-screen").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      /** Expanded controls must follow the rival, without flex shrink or inherited recorded-row layout. */
      const safety = await page.locator(".live-race-safety").boundingBox();
      /** Real rival identity bounds catch overlap even when the dialog itself fits. */
      const rival = await page.locator(".live-race-rival").boundingBox();
      expect(safety!.y).toBeGreaterThanOrEqual(rival!.y + rival!.height);
      for (const selector of ["summary", ".live-race-block", "select", ".live-race-report"]) {
        /** Browser control bounds verify horizontal fit and usable touch targets. */
        const control = await page.locator(`.live-race-safety ${selector}`).boundingBox();
        expect(control!.height).toBeGreaterThanOrEqual(44);
        expect(control!.x).toBeGreaterThanOrEqual(0);
        expect(control!.x + control!.width).toBeLessThanOrEqual(width + 1);
      }
      await page.locator(".live-race-safety").scrollIntoViewIfNeeded();
      await page.screenshot({path: `/tmp/live-race-safety-${target.toLowerCase()}-${width}.png`});
    }
    await page.screenshot({path: `/tmp/live-race-safety-${target.toLowerCase()}.png`});
    await page.locator(".live-race-block").evaluate((button: HTMLElement) => {button.click(); button.click();});
    await page.waitForFunction(() => document.querySelector(".live-race-block")?.hasAttribute("disabled"));
    await page.waitForFunction(() => !document.querySelector(".race-screen")?.textContent?.includes("LiveRival"));
    expect(blocks).toEqual([{liveTicketId: "b".repeat(64)}]);
    await page.locator(".race-close").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.waitForFunction(() => (document.querySelector(".live-race-start") as HTMLButtonElement | null)?.disabled === false);
    expect(updates.filter(input => input.action === "leave")).toHaveLength(1);
    expect(updates.every(input => input.ticketId === "b".repeat(64))).toBe(true);
    startsAtMs = null;
    await page.locator(".live-race-start").click();
    await page.locator(".live-race-self").getByText(`${target}Solver`, {exact: true}).waitFor();
    expect(joins).toHaveLength(3);
    expect(await page.locator(".live-race-safety").count()).toBe(0);
    expect(joins[2].requestId).not.toBe(joins[0].requestId);
    await page.locator(".race-close").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.locator(".race-close").click();
    await page.locator(".race-screen").waitFor({state: "detached"});
    expect(updates.filter(input => input.action === "leave")).toHaveLength(2);
    if (target === "Reddit") expect(requestUrls.every(url => new URL(url).origin === new URL(page.url()).origin &&
      new URL(url).pathname.startsWith("/api/"))).toBe(true);
    await page.setViewportSize({width: 390, height: 844});
  };
}
