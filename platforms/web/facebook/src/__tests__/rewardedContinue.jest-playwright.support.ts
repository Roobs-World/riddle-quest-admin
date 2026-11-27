import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Controls only the external entitlement response for the authenticated fixture account. */
export interface FacebookSubscriptionFixture {
  /** Number of authenticated document reads observed at the network boundary. */
  readonly requests: number;
  /** Selects an existing account's subscription state or a transient service failure. */
  respondWith(value: boolean | "unavailable"): void;
}

/** Exercises the real REST transport without reading or changing a live account. */
export async function installFacebookSubscriptionFixture(page: Page, account: {
  /** Project configured in the isolated Facebook artifact. */
  projectId: string;
  /** Verified global account supplied by the identity fixture. */
  uid: string;
  /** Fake Firebase ID token supplied by the auth fixture. */
  idToken: string;
  /** Fake App Check token supplied by the identity fixture. */
  appCheckToken: string;
}): Promise<FacebookSubscriptionFixture> {
  let response: boolean | "unavailable" = false;
  let requests = 0;
  const documentName = `projects/${account.projectId}/databases/(default)/documents/users/${account.uid}`;
  await page.route("https://firestore.googleapis.com/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    expect(decodeURIComponent(url.pathname)).toBe(`/v1/${documentName}`);
    expect([...url.searchParams]).toEqual([["mask.fieldPaths", "hasActiveSubscription"]]);
    // Keep assertion diagnostics free of credentials, even though these are fake tokens.
    expect(headers.authorization === `Bearer ${account.idToken}`).toBe(true);
    expect(headers["x-firebase-appcheck"] === account.appCheckToken).toBe(true);
    requests += 1;
    await route.fulfill({status: response === "unavailable" ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(response === "unavailable" ? {error: {status: "UNAVAILABLE"}} : {
        name: documentName, fields: {hasActiveSubscription: {booleanValue: response}},
      })});
  });
  return {get requests() {return requests;}, respondWith(value) {response = value;}};
}

/** Exercises real loss UI with controlled Meta completion and authoritative-response failures. */
export async function verifyRewardedContinue(page: Page, origin: string, subscription: FacebookSubscriptionFixture): Promise<void> {
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
  await page.clock.install();
  subscription.respondWith("unavailable");
  await openRewardedLoss(page, origin, true);
  /** Rendered rewarded-continuation button exercised by the browser. */
  const video = page.locator(".loss-video-action");
  await video.waitFor();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(await video.innerText()).toBe("Watch an ad for another attempt");
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

  // An unknown entitlement keeps the retry offer, but never acquires a native ad.
  const readsBeforeRetry = subscription.requests;
  await video.click();
  await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
  expect(subscription.requests).toBeGreaterThan(readsBeforeRetry);
  expect(await page.evaluate(() => window.__facebookEvents.some(value => value.startsWith("rewarded:placement:") || value.startsWith("ads:interstitial:") || value === "rewarded:show" || value === "ads:show"))).toBe(false);
  expect(await page.locator(".loss-continue-action").isEnabled()).toBe(true);
  expect(await page.locator(".loss-skip-action").isEnabled()).toBe(true);
  expect(await page.locator(".continue-balance span").innerText()).toBe(balance);
  expect(claims).toBe(0);
  // The same loss modal can recover as soon as a fresh authoritative read succeeds.
  subscription.respondWith(false);

  for (const phase of ["create", "load"] as const) {
    const before = await page.evaluate(() => ({
      creations: window.__facebookEvents.filter(value => value.startsWith("rewarded:placement:")).length,
      shows: window.__facebookEvents.filter(value => value === "rewarded:show").length,
    }));
    await page.evaluate(value => Reflect.set(window, "__rewardedMode", `hold-${value}`), phase);
    await video.click();
    await page.waitForFunction(() => Reflect.has(window, "__finishRewardedPreparation"));
    expect(await page.getByRole("status").filter({hasText: /^Loading$/}).isVisible()).toBe(true);
    expect(await page.locator(".loss-continue-action").isDisabled()).toBe(true);
    await page.clock.fastForward(30_001);
    await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
    expect(await page.getByRole("status").filter({hasText: /^Loading$/}).count()).toBe(0);
    expect(await page.locator(".loss-continue-action").isEnabled()).toBe(true);
    expect(await page.locator(".loss-skip-action").isEnabled()).toBe(true);
    expect(await page.locator(".continue-balance span").innerText()).toBe(balance);
    expect(claims).toBe(0);

    await video.click();
    await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
    expect(await page.evaluate(() => window.__facebookEvents.filter(value => value.startsWith("rewarded:placement:")).length)).toBe(before.creations + 1);
    expect(await page.evaluate(() => window.__facebookEvents.filter(value => value === "rewarded:show").length)).toBe(before.shows);
    await page.evaluate(() => Reflect.get(window, "__finishRewardedPreparation")());
    await page.waitForFunction(value => window.__facebookEvents.includes(`rewarded:preparation-settled:${value}`), phase);
    expect(await video.isVisible()).toBe(true);
    expect(await video.isEnabled()).toBe(true);
    expect(await page.evaluate(() => window.__facebookEvents.filter(value => value === "rewarded:show").length)).toBe(before.shows);
    expect(claims).toBe(0);

    // A fresh attempt must work without closing the modal or forcing another render.
    await page.evaluate(() => Reflect.set(window, "__rewardedMode", "no-fill"));
    await video.click();
    await page.waitForFunction(() => !(document.querySelector(".loss-video-action") as HTMLButtonElement)?.disabled);
    expect(await page.evaluate(() => window.__facebookEvents.filter(value => value.startsWith("rewarded:placement:")).length)).toBe(before.creations + 2);
    expect(await page.evaluate(() => window.__facebookEvents.filter(value => value === "rewarded:show").length)).toBe(before.shows);
    expect(claims).toBe(0);
  }
  await page.clock.setSystemTime(Date.now());

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

  subscription.respondWith(true);
  const readsBeforeSubscriber = subscription.requests;
  await openRewardedLoss(page, origin);
  expect(subscription.requests).toBeGreaterThan(readsBeforeSubscriber);
  expect(await video.count()).toBe(0);
  expect(await page.evaluate(() => window.__facebookEvents.some(value => value.startsWith("rewarded:placement:") || value.startsWith("ads:interstitial:") || value === "rewarded:show" || value === "ads:show"))).toBe(false);
  expect(await page.locator(".loss-continue-action").isEnabled()).toBe(true);
  expect(await page.locator(".loss-skip-action").isEnabled()).toBe(true);
  expect(claims).toBe(2);

  // A subscription acquired while Meta loads the video wins over the earlier read.
  subscription.respondWith(false);
  const readsBeforeResume = subscription.requests;
  await page.evaluate(() => window.__facebookResume?.());
  await video.waitFor();
  expect(subscription.requests).toBeGreaterThan(readsBeforeResume);
  await page.evaluate(() => Reflect.set(window, "__rewardedMode", "hold-load"));
  await video.click();
  await page.waitForFunction(() => Reflect.has(window, "__finishRewardedPreparation"));
  const readsBeforeLoadSettles = subscription.requests;
  subscription.respondWith(true);
  await page.evaluate(() => Reflect.get(window, "__finishRewardedPreparation")());
  await video.waitFor({state: "detached"});
  expect(subscription.requests).toBeGreaterThan(readsBeforeLoadSettles);
  expect(await page.evaluate(() => window.__facebookEvents.filter(value => value.startsWith("rewarded:placement:")).length)).toBe(1);
  expect(await page.evaluate(() => window.__facebookEvents.includes("rewarded:load"))).toBe(true);
  expect(await page.evaluate(() => window.__facebookEvents.includes("rewarded:show"))).toBe(false);
  expect(await page.locator(".loss-continue-action").isEnabled()).toBe(true);
  expect(await page.locator(".loss-skip-action").isEnabled()).toBe(true);
  expect(await page.locator(".continue-balance span").innerText()).toBe(balance);
  expect(claims).toBe(2);
  await page.locator(".loss-continue-action").click();
  await page.locator(".modal-continue").waitFor({state: "detached"});
  expect(await page.locator(".guess-row:first-child .cell:not(:disabled)").count()).toBe(5);
  expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe("250");

  subscription.respondWith(false);
  await page.goto(`${origin}/?harness=race`);
  await page.locator(".game-bottom-navigation").waitFor();
  expect(await page.locator(".loss-video-action").count()).toBe(0);
}

/** Reaches the actual loss controls through onboarding and five incorrect guesses. */
async function openRewardedLoss(page: Page, origin: string, firstVisit = false): Promise<void> {
  await page.goto(`${origin}/?harness=race&rewarded=on`);
  await page.locator(".game-bottom-navigation").waitFor();
  await page.locator(".onboarding-card-welcome .play-primary").click();
  await page.locator(".onboarding-clues").waitFor();
  await page.locator(".onboarding-card .play-primary").click();
  if (firstVisit) {
    for (const id of ["gameHint", "submitAnswer", "gameSkip", "gameMultiplayer"]) {
      const tooltip = page.locator(`.tooltip-backdrop[data-tooltip-id="${id}"]`);
      await tooltip.waitFor();
      await tooltip.locator("button").click();
    }
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
  for (const letter of ["X", "Z", "Q", "V", "B"]) {
    for (let slot = 0; slot < 5; slot += 1) await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    await page.locator(".submit-action").click();
    await page.locator(".guess-row .cell.red").last().waitFor();
    if (firstVisit && letter === "X") await page.locator('[data-tooltip-id="hintAfterWrongGuess"] button').click();
  }
  await page.locator(".modal-continue").waitFor();
}
