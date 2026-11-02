import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";
import {LiveRaceViewSchema, type JoinLiveRace} from "@riddle-quest/core/race";

/** Exercises chosen-context private play through the built Facebook entry, SDK and authenticated transport. */
export async function verifyContextChallenges(page: Page): Promise<void> {
  /** Only the server response supplies the opaque lobby handle. */
  const challengeId = `live_${"d".repeat(64)}`, ticketId = "d".repeat(64);
  /** Authoritative private creation intents are captured at the real callable boundary. */
  const joins: JoinLiveRace[] = [];
  /** Native context choice begins before any server seat exists. */
  const before = await page.evaluate(() => Reflect.get(window, "__contextDialogCalls"));
  /** Private lobby never becomes a public search or a bot matchup. */
  const snapshot = () => LiveRaceViewSchema.parse({ticketId, challengeId, phase: "searching", serverNowMs: Date.now(),
    searchEndsAtMs: Date.now() + 900000, startsAtMs: null, player: {displayName: "ContextPlayer", avatarUrl: null, bot: false, correctCount: 0},
    opponent: null, run: null, result: null, rewardCoins: 0});
  await page.route("**/joinLiveRace", route => {
    joins.push(route.request().postDataJSON().data);
    return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: snapshot()})});
  });
  await page.route("**/updateLiveRace", route => {
    /** Closing this fixture owns an explicit private-seat cancellation. */
    const leaving = route.request().postDataJSON().data.action === "leave";
    return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {...snapshot(), ...(leaving ? {phase: "cancelled"} : {})}})});
  });
  /** The chooser lives alongside the selected category, rather than silently starting global play. */
  const choose = page.locator(".live-race-context-challenge");
  await choose.waitFor();
  await choose.evaluate((button: HTMLElement) => {button.click(); button.click();});
  expect(await page.evaluate(() => Reflect.get(window, "__contextDialogCalls"))).toBe(before + 1);
  expect(joins).toHaveLength(0);
  await page.evaluate(() => Reflect.get(window, "__finishContextDialog")(false, true));
  await choose.waitFor({state: "visible"});
  await page.waitForFunction(() => !document.querySelector(".live-race-context-challenge")?.hasAttribute("disabled"));
  expect(joins).toHaveLength(0); expect(await page.getByRole("alert").count()).toBe(0);
  /** Leaving the intro while native selection is pending must retire its private-seat creation. */
  await choose.click(); await page.getByRole("tab").nth(1).click();
  await page.evaluate(() => Reflect.get(window, "__finishContextDialog")(true));
  await page.waitForFunction(() => document.querySelector(".race-context-board")?.textContent?.includes("0:02.0"));
  await page.getByRole("tab").first().click();
  await choose.waitFor(); expect(joins).toHaveLength(0);
  await choose.click(); await page.evaluate(() => Reflect.get(window, "__finishContextDialog")(true));
  await page.locator(".live-race-invite-share").waitFor();
  expect(joins).toHaveLength(1);
  expect(joins[0]).toMatchObject({categoryId: "mixed", locale: "fr", createChallenge: true, facebookContextId: "context-new"});
  expect(joins[0].challengeId).toBeUndefined();
  expect(await page.evaluate(() => Reflect.get(window, "__contextUpdates"))).toEqual([]);
  /** External native switches cannot retarget an already-created private invitation. */
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("wrong-group"));
  await page.locator(".live-race-invite-share > button").click();
  await page.locator(".live-race-invite-share [role=alert]").waitFor();
  expect(await page.evaluate(() => Reflect.get(window, "__contextUpdates"))).toEqual([]);
  /** Returning to the original native audience permits an explicit player-requested context update. */
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("context-new"));
  await page.locator(".live-race-invite-share > button").click();
  await page.waitForFunction(() => Reflect.get(window, "__contextUpdates")?.length === 1);
  /** Read only nonidentity SDK payload fields captured by the fixture. */
  const deliveries = await page.evaluate(() => Reflect.get(window, "__contextUpdates").map((value: {
    /** Native context at dispatch. */ contextId: string;
    /** Exact SDK payload fields. */ payload: Record<string, unknown>;
  }) => ({...value, payload: {...value.payload, image: typeof value.payload.image === "string" ? value.payload.image.slice(0, 22) : null}})));
  expect(deliveries).toEqual([{contextId: "context-new", payload: {action: "CUSTOM", template: "race_context_challenge",
    image: "data:image/png;base64,", text: {default: "Race to 10 · Challenge a friend", localizations: {fr_FR: "Course à 10 · Défier un ami"}},
    data: {challengeId}, strategy: "IMMEDIATE", notification: "NO_PUSH"}}]);
  await page.locator(".live-race-invite-share > button").click();
  expect(await page.evaluate(() => Reflect.get(window, "__contextUpdates").length)).toBe(1);
  await page.screenshot({path: process.env.FACEBOOK_CONTEXT_CHALLENGE_SCREENSHOT_PATH ?? "/tmp/facebook-private-context-challenge.png"});
  await page.locator(".race-close").click();
  await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
  expect(joins).toHaveLength(1);
}
