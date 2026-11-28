import {expect} from "@jest/globals";
import {expect as expectBrowser, type Page} from "@playwright/test";
import {openRewardedLoss, type FacebookSubscriptionFixture} from "./rewardedContinue.jest-playwright.support";

type HostInterruption = "pause" | "hidden";
type AdFormat = "rewarded" | "interstitial";

/** Controls only the provider's asynchronous creation, loading and display promises. */
async function deferNativeAd(page: Page, format: AdFormat, phase: "create" | "load" | "show") {
  await page.evaluate(({format, phase}) => {
    const events: string[] = [];
    Reflect.set(window, "__adLifecycleEvents", events);
    const step = async (name: string) => {
      events.push(name);
      if (name === phase) await new Promise<void>(resolve => Reflect.set(window, "__settleLifecycleAd", () => {
        Reflect.deleteProperty(window, "__settleLifecycleAd");
        resolve();
      }));
      events.push(`${name}:settled`);
    };
    const create = async (placementId: string) => {
      await step("create");
      return {
        getPlacementID: () => placementId,
        loadAsync: () => step("load"),
        async showAsync() {
          await step("show");
          events.push("complete");
        },
      };
    };
    window.FBInstant![format === "rewarded" ? "getRewardedVideoAsync" : "getInterstitialAdAsync"] = create;
  }, {format, phase});
}

/** Native pause can occur with a visible document; visibility is a separate external host signal. */
async function interruptHost(page: Page, interruption: HostInterruption, resume: boolean) {
  await page.evaluate(({interruption, resume}) => {
    if (interruption === "pause") {
      if (resume) window.__facebookResume?.();
      else window.__facebookPause?.();
    } else {
      Object.defineProperty(document, "visibilityState", {configurable: true, value: resume ? "visible" : "hidden"});
      document.dispatchEvent(new Event("visibilitychange"));
    }
  }, {interruption, resume});
  if (interruption === "pause") {
    await page.locator(".game-app.paused").waitFor({state: resume ? "detached" : "visible"});
    expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
  }
}

const events = (page: Page) => page.evaluate(() => Reflect.get(window, "__adLifecycleEvents") as string[]);
const settle = (page: Page) => page.evaluate(() => Reflect.get(window, "__settleLifecycleAd")());
const waitForLossAction = (page: Page) => page.waitForFunction(() => {
  const action = document.querySelector<HTMLButtonElement>(".loss-video-action");
  return !action || !action.disabled;
});

/** Drives foreground changes through the mounted entry, without calling application controllers. */
export async function verifyAdLifecycle(page: Page, origin: string, subscription: FacebookSubscriptionFixture): Promise<void> {
  await page.goto("about:blank");
  const browserStorage = await page.context().newCDPSession(page);
  try {
    await browserStorage.send("Storage.clearDataForOrigin", {origin, storageTypes: "all"});
  } finally {await browserStorage.detach();}
  let firstVisit = true;
  let claims = 0;
  await page.route("**/grantFacebookRewardedContinue", route => {
    claims++;
    return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {newCoins: 300}})});
  });
  subscription.respondWith(false);
  for (const [interruption, phase, resumeBeforeSettlement] of [
    ["pause", "load", false], ["pause", "create", true],
    ["hidden", "load", true], ["hidden", "create", false],
  ] as const) {
    await openRewardedLoss(page, origin, firstVisit);
    firstVisit = false;
    const balance = await page.locator(".continue-balance span").innerText();
    const claimsBefore = claims;
    await deferNativeAd(page, "rewarded", phase);
    await page.locator(".loss-video-action").click();
    await page.waitForFunction(() => Reflect.has(window, "__settleLifecycleAd"));
    await interruptHost(page, interruption, false);
    if (resumeBeforeSettlement) await interruptHost(page, interruption, true);
    await settle(page);
    await waitForLossAction(page);
    expect(await events(page)).not.toContain("show");
    expect(claims).toBe(claimsBefore);
    expect(await page.locator(".continue-balance span").innerText()).toBe(balance);
    if (!resumeBeforeSettlement) await interruptHost(page, interruption, true);
    for (const selector of [".loss-video-action", ".loss-continue-action", ".loss-skip-action"])
      expect(await page.locator(selector).isEnabled()).toBe(true);

    // A fresh foreground click still opens an ad; pausing after show must not discard an earned continuation.
    await deferNativeAd(page, "rewarded", "show");
    await page.locator(".loss-video-action").click();
    await page.waitForFunction(() => Reflect.has(window, "__settleLifecycleAd"));
    expect((await events(page)).filter(event => event === "show")).toHaveLength(1);
    await interruptHost(page, "pause", false);
    expect(claims).toBe(claimsBefore);
    expect(await page.locator(".loss-video-action").isDisabled()).toBe(true);
    await page.keyboard.press("Escape");
    expect(await page.locator(".modal-continue").isVisible()).toBe(true);
    await settle(page);
    await page.locator(".modal-continue").waitFor({state: "detached"});
    expect(claims).toBe(claimsBefore + 1);
    expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe("300");
    await interruptHost(page, "pause", true);
    expect(await page.locator(".guess-row:first-child .cell:not(:disabled)").count()).toBe(5);
  }

  for (const [interruption, phase] of [["pause", "load"], ["hidden", "create"]] as const) {
    await page.goto(`${origin}/?harness=race&rewarded=on`);
    await page.locator(".onboarding-card-welcome .play-primary").click();
    await page.locator(".onboarding-clues").waitFor();
    await page.locator(".onboarding-card .play-primary").click();
    await page.locator(".onboarding-card").waitFor({state: "detached"});
    await deferNativeAd(page, "interstitial", phase);
    for (const [answer, clue] of [["PIANO", ""], ["CLOCK", "What has a face and hands but no arms?"],
      ["GLOVE", "What has a thumb and four fingers but is not alive?"]]) {
      if (clue) await page.getByText(clue, {exact: true}).waitFor();
      for (let tip = 0; tip < 3 && await page.locator(".tooltip-backdrop").count(); tip++)
        await page.locator(".tooltip-backdrop").first().locator("button").click();
      await page.locator(".guess-row .cell:not(:disabled)").first().click();
      for (const letter of answer) await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await page.locator(".submit-action").click();
      await page.locator(".fanfare-content .reward-continue").waitFor();
      if (answer !== "GLOVE") {
        await page.locator(".fanfare-content .reward-continue").click();
        await page.locator(".fanfare-content").waitFor({state: "detached"});
      }
    }
    await page.waitForFunction(() => Reflect.has(window, "__settleLifecycleAd"));
    const balance = await page.locator(".game-header .coin-pill strong").innerText();
    await interruptHost(page, interruption, false);
    await interruptHost(page, interruption, true);
    await settle(page);
    // A cancelled native share proves the prior ad released the shared dialog gate before assertions.
    await expectBrowser.poll(async () => {
      await page.locator(".fanfare-content .play-secondary").click();
      return page.evaluate(() => (Reflect.get(window, "__facebookShares") ?? []).length);
    }).toBe(1);
    expect(await events(page)).not.toContain("show");
    expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe(balance);
    expect(await page.locator(".fanfare-content .reward-continue").isEnabled()).toBe(true);
  }
}
