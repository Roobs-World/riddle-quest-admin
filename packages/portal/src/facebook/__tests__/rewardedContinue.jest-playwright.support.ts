import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Exercises real loss UI with controlled Meta completion and authoritative-response failures. */
export async function verifyRewardedContinue(page: Page, origin: string): Promise<void> {
  let claims = 0;
  const requests: Array<{body: unknown; authorization?: string; appCheck?: string; completed: boolean}> = [];
  await page.route("**/grantFacebookRewardedContinue", async route => {
    claims += 1;
    const headers = await route.request().allHeaders();
    requests.push({body: route.request().postDataJSON(), authorization: headers.authorization,
      appCheck: headers["x-firebase-appcheck"], completed: await page.evaluate(() => window.__facebookEvents.includes("rewarded:complete"))});
    await route.fulfill({status: claims === 1 ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(claims === 1 ? {error: {status: "UNAVAILABLE", message: "retry"}} : {data: {newCoins: 300}})});
  });
  await page.goto(`${origin}/?harness=race&rewarded=on`);
  await page.locator(".game-bottom-navigation").waitFor();
  await page.locator(".onboarding-card-welcome .play-primary").click();
  await page.locator(".onboarding-clues").waitFor();
  await page.locator(".onboarding-card .play-primary").click();
  for (const id of ["gameHint", "submitAnswer", "gameSkip"]) {
    const tooltip = page.locator(`.tooltip-backdrop[data-tooltip-id="${id}"]`);
    await tooltip.waitFor();
    await tooltip.locator("button").click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const letter of "CRANE") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    await page.locator(".submit-action").click();
    await page.waitForFunction(() => !document.querySelector(".submit-action")?.hasAttribute("aria-busy"));
    const tip = page.locator('[data-tooltip-id="hintAfterWrongGuess"] button');
    if (await tip.isVisible()) await tip.click();
  }
  const video = page.locator(".loss-video-action");
  await video.waitFor();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(await video.innerText()).toBe("Watch a video for an extra try");
  expect(await page.locator(".loss-continue-action").innerText()).toContain("100");
  const balance = await page.locator(".continue-balance span").innerText();
  expect(await page.locator(".loss-shop-action").count()).toBe(0);

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
  expect(await page.locator(".guess-row").count()).toBe(1);
  await page.screenshot({path: "/tmp/facebook-rewarded-extra-try.png"});

  await page.goto(`${origin}/?harness=race`);
  await page.locator(".game-bottom-navigation").waitFor();
  expect(await page.locator(".loss-video-action").count()).toBe(0);
}
