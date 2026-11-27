import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Exercises real loss UI with controlled Meta completion and authoritative-response failures. */
export async function verifyRewardedContinue(page: Page, origin: string): Promise<void> {
  /** Counts authoritative requests, including the simulated retryable delivery failure. */
  let claims = 0;
  /** Captured grant deliveries verify identical payloads and authenticated completion. */
  const requests: Array<{
  /** Session-bound grant payload observed at the browser network boundary. */
  body: unknown;
  /** Bearer identity attached to the authoritative grant request. */
  authorization?: string;
  /** App Check proof attached to the authoritative grant request. */
  appCheck?: string;
  /** Whether Meta completion was observed before the grant request. */
  completed: boolean}> = [];
  await page.route("**/grantFacebookRewardedContinue", async route => {
    claims += 1;
    /** Observed request headers verify identity and App Check transport. */
    const headers = await route.request().allHeaders();
    requests.push({body: route.request().postDataJSON(), authorization: headers.authorization,
      appCheck: headers["x-firebase-appcheck"], completed: await page.evaluate(() => window.__facebookEvents.includes("rewarded:complete"))});
    await route.fulfill({status: claims === 1 ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(claims === 1 ? {error: {status: "UNAVAILABLE", message: "retry"}} : {data: {newCoins: 300}})});
  });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`${origin}/?harness=race&rewarded=on`);
  await page.locator(".game-bottom-navigation").waitFor();
  await page.locator(".onboarding-card-welcome .play-primary").click();
  await page.locator(".onboarding-clues").waitFor();
  await page.locator(".onboarding-card .play-primary").click();
  for (const id of ["gameHint", "submitAnswer", "gameSkip", "gameMultiplayer"]) {
    /** Existing onboarding prompt dismissed before exercising the loss controls. */
    const tooltip = page.locator(`.tooltip-backdrop[data-tooltip-id="${id}"]`);
    await tooltip.waitFor();
    await tooltip.locator("button").click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
  for (const letter of ["X", "Z", "Q", "V", "B"]) {
    for (let slot = 0; slot < 5; slot += 1) await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    await page.locator(".submit-action").click();
    await page.locator(".guess-row .cell.red").last().waitFor();
    if (letter === "X") await page.locator('[data-tooltip-id="hintAfterWrongGuess"] button').click();
  }
  /** Rendered rewarded-continuation button exercised by the browser. */
  const video = page.locator(".loss-video-action");
  await video.waitFor();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(await video.innerText()).toBe("Watch a video for an extra try");
  expect(await page.locator(".loss-continue-action").innerText()).toContain("50");
  /** Displayed balance before cancelled or unavailable video must remain unchanged. */
  const balance = await page.locator(".continue-balance span").innerText();
  expect(await page.locator(".loss-shop-action").count()).toBe(0);
  for (const selector of [".loss-video-action", ".loss-continue-action", ".loss-skip-action"]) {
    /** Rendered action bounds verify controls fit the mobile viewport. */
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({path: "/tmp/facebook-rewarded-loss-options.png"});

  await page.evaluate(() => Reflect.set(window, "__rewardedMode", "cancel"));
  await video.click();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(claims).toBe(0);
  expect(await page.locator(".continue-balance span").innerText()).toBe(balance);

  await page.evaluate(() => Reflect.set(window, "__rewardedMode", "no-fill"));
  await video.click();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(claims).toBe(0);
  expect(await page.locator(".loss-continue-action").isEnabled()).toBe(true);

  await page.evaluate(() => Reflect.set(window, "__rewardedMode", "hold"));
  await video.click();
  await page.waitForFunction(() => Reflect.has(window, "__finishRewarded"));
  expect(await video.isDisabled()).toBe(true);
  expect(await page.locator(".loss-continue-action").isDisabled()).toBe(true);
  expect(await page.locator(".loss-skip-action").isDisabled()).toBe(true);
  await page.keyboard.press("Escape");
  expect(await page.locator(".modal-continue").isVisible()).toBe(true);
  /** Video presentation count must not increase on a grant delivery retry. */
  const shows = await page.evaluate(() => window.__facebookEvents.filter(value => value === "rewarded:show").length);
  await page.evaluate(() => Reflect.get(window, "__finishRewarded")());
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(claims).toBe(1);
  await video.click();
  await page.locator(".modal-continue").waitFor({state: "detached"});
  expect(claims).toBe(2);
  expect(await page.evaluate(() => window.__facebookEvents.filter(value => value === "rewarded:show").length)).toBe(shows);
  expect(requests[0]?.body).toEqual(requests[1]?.body);
  for (const request of requests) {
    expect(request.authorization).toMatch(/^Bearer /);
    expect(request.appCheck).toBeTruthy();
    expect(request.completed).toBe(true);
  }
  expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe("300");
  expect(await page.locator(".guess-row:first-child .cell:not(:disabled)").count()).toBe(5);
  expect(await page.locator(".guess-row .cell.red").count()).toBe(0);
  await page.screenshot({path: "/tmp/facebook-rewarded-extra-try.png"});

  await page.goto(`${origin}/?harness=race`);
  await page.locator(".game-bottom-navigation").waitFor();
  expect(await page.locator(".loss-video-action").count()).toBe(0);
}
