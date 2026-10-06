import {expect} from "@jest/globals";
import type {Page, Route} from "@playwright/test";
import {LiveRaceViewSchema, type JoinLiveRace} from "@qwordly/core/race";

/** Exercises both rematch entry points and explicit inbox acceptance through each actual target adapter. */
export async function installLiveRematchJourney(page: Page, target: "Facebook" | "Reddit", requestUrls: string[]) {
  /** Immutable provider join inputs prove exact source and retry binding. */
  const joins: JoinLiveRace[] = [];
  /** Explicit recipient acceptance has its own server-issued handle. */
  const accepts: JoinLiveRace[] = [];
  /** Existing inbox preview is sufficient; it must not trigger one extra request per notice. */
  let previewReads = 0;
  /** Fixture release moves the first private lobby to a terminal tie only when requested. */
  let complete = false;
  /** Incoming notices are discovered when the player returns to Play. */
  let inbox = false;
  /** Active locale is supplied by the real entry selected for this journey. */
  let locale = "en";
  /** Private handle and owner tickets remain opaque synthetic test values. */
  const incomingId = `live_${"9".repeat(64)}`;
  /** Target response envelopes match production transport exactly. */
  const reply = (route: Route, value: unknown, status = 200) => route.fulfill({status, contentType: "application/json",
    body: JSON.stringify(status === 200 ? target === "Reddit" ? {ok: true, result: value} : {data: value} :
      {error: target === "Reddit" ? "private rematch diagnostic" : {status: "UNAVAILABLE", message: "private rematch diagnostic"}})});
  /** Only the original reserved pair is presented; no grant or rival selector enters this fixture. */
  const snapshot = (ticketId: string, action?: string) => LiveRaceViewSchema.parse({ticketId,
    phase: action === "leave" ? "cancelled" : ticketId === "e".repeat(64) && complete ? "result" : ticketId === "8".repeat(64) ? "countdown" : "searching",
    serverNowMs: Date.now(), searchEndsAtMs: Date.now() + 900_000, startsAtMs: ticketId === "8".repeat(64) ? Date.now() + 600_000 : null,
    player: {displayName: `${target}Solver`, avatarUrl: null, bot: false, correctCount: 0},
    opponent: ticketId === "e".repeat(64) && complete || ticketId === "8".repeat(64)
      ? {displayName: "RematchRival", avatarUrl: null, bot: false, correctCount: 0} : null,
    result: ticketId === "e".repeat(64) && complete && action !== "leave" ? "tie" : null, rewardCoins: 0, run: null,
    ...(ticketId === "8".repeat(64) ? {} : {challengeId: `live_${ticketId}`}),
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.join" : "**/joinLiveRace", route => {
    /** Real adapter carries only portable authority inputs. */
    const raw = route.request().postDataJSON(), input = target === "Reddit" ? raw : raw.data;
    if (input.rematchOfTicketId) {
      joins.push(input); requestUrls.push(route.request().url());
      return joins.length === 1 ? reply(route, null, 503) : reply(route, snapshot((input.rematchOfTicketId === "d".repeat(64) ? "e" : "f").repeat(64)));
    }
    if (input.challengeId === incomingId) {accepts.push(input); requestUrls.push(route.request().url()); return reply(route, snapshot("8".repeat(64)));}
    return route.fallback();
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.update" : "**/updateLiveRace", route => {
    /** Owned private seat updates retain the existing poll/leave protocol. */
    const raw = route.request().postDataJSON(), input = target === "Reddit" ? raw : raw.data;
    if (!["e", "f", "8"].map(letter => letter.repeat(64)).includes(input.ticketId)) return route.fallback();
    requestUrls.push(route.request().url());
    return reply(route, snapshot(input.ticketId, input.action));
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.inbox" : "**/listLiveRaceChallenges", route => {
    requestUrls.push(route.request().url());
    /** Inbox reads have no account or content authority selector. */
    const raw = route.request().postDataJSON();
    expect(target === "Reddit" ? raw : raw.data).toEqual({});
    return reply(route, !inbox ? [] : [
      {challengeId: incomingId, locale, categoryId: "history", expiresAtMs: Date.now() + 900_000, status: "available",
        creator: {displayName: "RematchInviter", avatarUrl: null, bot: false, correctCount: 0}},
      {challengeId: `live_${"7".repeat(64)}`, locale: locale === "fr" ? "en" : "fr", categoryId: "history", expiresAtMs: Date.now() + 900_000, status: "available",
        creator: {displayName: "ForeignLocaleInviter", avatarUrl: null, bot: false, correctCount: 0}},
    ]);
  });
  await page.route(target === "Reddit" ? "**/api/game/race.live.challenge" : "**/getLiveRaceChallenge", route => {
    /** Retain existing native-entry fixtures outside this owned incoming handle. */
    const raw = route.request().postDataJSON(), input = target === "Reddit" ? raw : raw.data;
    if (input.challengeId !== incomingId) return route.fallback();
    previewReads++;
    return reply(route, {challengeId: incomingId, locale, categoryId: "history", expiresAtMs: Date.now() + 900_000,
      status: "available", creator: {displayName: "RematchInviter", avatarUrl: null, bot: false, correctCount: 0}});
  });
  return async (activeLocale: string) => {
    locale = activeLocale;
    /** Facebook captures the synchronized native context while Reddit has no provider selector. */
    const facebookContextId = target === "Facebook" ? await page.evaluate(() => window.FBInstant?.context?.getID()) : undefined;
    if (target === "Facebook") expect(facebookContextId).toEqual(expect.any(String));
    await page.locator(".live-race-history .live-race-rematch").click();
    await page.locator(".race-error").waitFor();
    expect(await page.locator(".race-error").innerText()).not.toContain("private rematch diagnostic");
    await page.locator(".race-error button").click();
    await page.locator(".live-race-self").getByText(`${target}Solver`, {exact: true}).waitFor();
    expect(joins[0]).toEqual(joins[1]);
    expect(joins[0]).toEqual({locale, categoryId: "history", rematchOfTicketId: "d".repeat(64), requestId: expect.any(String),
      ...(target === "Facebook" ? {facebookContextId} : {})});
    expect(await page.locator(".live-race-invite-share").count()).toBe(0);
    complete = true;
    await page.locator(".live-race-victory .live-race-rematch").waitFor();
    expect(await page.locator(".live-race-reward").count()).toBe(0);
    await page.locator(".race-coin-balance img").evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      if (!image.naturalWidth) throw new Error("Race coin asset did not render");
    });
    await page.screenshot({path: `/tmp/live-race-rematch-${target.toLowerCase()}.png`});
    await page.locator(".live-race-victory .live-race-rematch").click();
    await page.locator(".live-race-self").getByText(`${target}Solver`, {exact: true}).waitFor();
    expect(joins.at(-1)).toMatchObject({locale, categoryId: "history", rematchOfTicketId: "e".repeat(64)});
    expect(joins.at(-1)!.requestId).not.toBe(joins[0].requestId);
    expect(await page.locator(".live-race-invite-share").count()).toBe(0);
    inbox = true;
    await page.locator(".race-close").click();
    await page.locator(".live-race-invitation").getByText(/RematchInviter/).waitFor();
    expect(await page.locator(".live-race-invitation").count()).toBe(1);
    expect(accepts).toHaveLength(0); expect(previewReads).toBe(0);
    await page.locator(".live-race-invitation button").click();
    await page.locator(".live-race-self").getByText(`${target}Solver`, {exact: true}).waitFor();
    expect(accepts).toEqual([{locale, categoryId: "history", challengeId: incomingId, requestId: expect.any(String),
      ...(target === "Facebook" ? {facebookContextId} : {})}]);
    inbox = false;
    await page.locator(".race-close").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.locator('.race-hub-tabs [role="tab"]').nth(1).click();
    await page.locator(".live-race-history-entry").waitFor();
  };
}
