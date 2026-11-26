import {expect} from "@jest/globals";
import type {Page, Route} from "@playwright/test";

/** Exercises target transport, locale validation, bounded read retirement and current Activity presentation. */
export async function installLiveHistoryJourney(page: Page, target: "Reddit", requestUrls: string[]) {
  /** Existing context tests see a valid empty history until this dedicated journey begins. */
  let mode: "empty" | "failure" | "results" | "blocked" | "wrong-locale" | "late" | "guest" | "legacy-bot" = "empty";
  /** The original HTTP observer can finish after the player retires its tab. */
  let pending: Route | undefined;
  /** Captured inputs verify strict provider transport without user or opponent selectors. */
  const requests: unknown[] = [];
  /** Current authority response keeps synthetic rows within the logical retention window. */
  const reply = (route: Route, locale: string, name = "HistoryRival") => {
    /** Bots retain synthetic scores even without an available human profile. */
    const bot = mode === "guest" || mode === "legacy-bot";
    /** Only the result vocabulary accepted by the real public schema is emitted. */
    const value = {locale, serverNowMs: Date.now(), entries: mode === "empty" ? [] : [{ticketId: "d".repeat(64), categoryId: "history",
      createdAtMs: Date.now() - 60_000, result: "win", correctCount: 10, rewardCoins: 50, opponentAvailable: mode !== "blocked" && !bot,
      opponent: {displayName: mode === "blocked" ? "Opponent" : mode === "guest" ? "Guest_ABC123" : mode === "legacy-bot" ? "Riddle Bot" : name, avatarUrl: null, level: 1, bot, correctCount: mode === "blocked" ? 0 : 6}}]};
    return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(target === "Reddit" ? {ok: true, result: value} : {data: value})});
  };
  await page.route(target === "Reddit" ? "**/api/game/race.live.history" : "**/listLiveRaceHistory", route => {
    /** Real adapter request chooses the active content language and bounded count. */
    const raw = route.request().postDataJSON(), input = target === "Reddit" ? raw : raw.data;
    requests.push(input); requestUrls.push(route.request().url());
    if (mode === "late" || mode === "blocked") {pending = route; return;}
    if (mode === "failure") return route.fulfill({status: 503, contentType: "application/json",
      body: JSON.stringify({error: target === "Reddit" ? "private history diagnostic" : {status: "UNAVAILABLE", message: "private history diagnostic"}})});
    return reply(route, mode === "wrong-locale" ? input.locale === "en" ? "fr" : "en" : input.locale);
  });
  return async (locale: string, verifyRematch?: (locale: string) => Promise<void>) => {
    mode = "failure";
    await page.locator(".multiplayer-navigation-action").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
    await page.locator(".live-race-history .race-error").waitFor();
    expect(await page.locator(".live-race-history .race-error").innerText()).not.toContain("private history diagnostic");
    mode = "results";
    await page.locator(".live-race-history .race-error button").click();
    await page.locator(".live-race-history-entry").getByText("HistoryRival", {exact: true}).waitFor();
    expect(requests.at(-1)).toEqual({locale, limit: 20});
    expect(await page.locator(".live-race-history-score").innerText()).toContain("10/10");
    expect(await page.locator(".live-race-history-score").innerText()).toContain("6/10");
    expect(await page.locator(".live-race-history-entry > p").innerText()).toContain("50");
    expect(await page.locator(".live-race-history .live-race-safety summary").count()).toBe(1);
    for (const width of [390, 1280]) {
      await page.setViewportSize({width, height: 844});
      await page.locator(".live-race-history").scrollIntoViewIfNeeded();
      /** Actual rendered result rows must fit inside both tested viewports. */
      const bounds = await page.locator(".live-race-history").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      await page.screenshot({path: `/tmp/live-race-history-${target.toLowerCase()}-${width}.png`});
    }
    if (verifyRematch) await verifyRematch(locale);
    mode = "blocked";
    await page.locator(".live-race-history .live-race-safety summary").click();
    await page.locator(".live-race-history .live-race-block").click();
    // Hold the refresh to prove confirmed blocking retires the old projection immediately.
    for (let attempt = 0; attempt < 100 && !pending; attempt++) await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(pending).toBeDefined();
    expect(await page.locator(".live-race-history-entry").count()).toBe(0);
    expect(await page.locator(".live-race-history").innerText()).not.toContain("HistoryRival");
    await reply(pending!, locale);
    pending = undefined;
    await page.locator(".live-race-history-entry").waitFor();
    expect(await page.locator(".live-race-history-entry").innerText()).not.toContain("HistoryRival");
    expect(await page.locator(".live-race-history-score").innerText()).toContain("—");
    expect(await page.locator(".live-race-history .live-race-safety").count()).toBe(0);
    expect(await page.locator(".live-race-history .live-race-rematch").count()).toBe(0);
    /** Literal oracles cover the actual French and Arabic adapter journeys independently of production translation code. */
    const legacyOpponentLabel = locale === "fr" ? "Adversaire" : locale === "ar" ? "الخصم" : "Opponent";
    /** Real Reddit adapters preserve assigned guests and localise retained legacy labels. */
    for (const [botMode, label] of [["guest", "Guest_ABC123"], ["legacy-bot", legacyOpponentLabel]] as const) {
      await page.locator('.race-hub-tabs [role="tab"]').first().click();
      mode = botMode;
      await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
      await page.locator(".live-race-history-entry").getByText(label, {exact: true}).waitFor();
      expect(await page.locator(".live-race-history-score").innerText()).toContain("6/10");
      expect(await page.locator(".live-race-history-entry").innerText()).not.toMatch(/\bbot\b|🤖/i);
      expect(await page.locator(".live-race-history .live-race-safety").count()).toBe(0);
      expect(await page.locator(".live-race-history .live-race-rematch").count()).toBe(0);
    }
    await page.locator('.race-hub-tabs [role="tab"]').first().click();
    mode = "wrong-locale";
    await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
    await page.locator(".live-race-history .race-error").waitFor();
    expect(await page.locator(".live-race-history-entry").count()).toBe(0);
    mode = "empty";
    await page.locator(".live-race-history .race-error button").click();
    await page.locator(".live-race-history .race-error").waitFor({state: "detached"});
    await page.waitForFunction(() => !document.querySelector(".live-race-history [role=status]"));
    expect(await page.locator(".live-race-history-entry").count()).toBe(0);
    expect(await page.locator(".live-race-history .live-race-safety").count()).toBe(0);
    await page.locator('.race-hub-tabs [role="tab"]').first().click();
    mode = "late";
    await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
    await page.locator(".live-race-history [role=status]").waitFor();
    // Wait for this owned HTTP request rather than sleeping and assuming it was sent.
    for (let attempt = 0; attempt < 100 && !pending; attempt++) await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(pending).toBeDefined();
    await page.locator('.race-hub-tabs [role="tab"]').first().click();
    mode = "results";
    await reply(pending!, locale, "RetiredHistoryRival");
    mode = "empty";
    await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
    await page.waitForFunction(() => !document.querySelector(".live-race-history [role=status]"));
    expect(await page.locator(".live-race-history").innerText()).not.toContain("RetiredHistoryRival");
    await page.locator(".race-close").click();
    await page.setViewportSize({width: 390, height: 844});
  };
}
