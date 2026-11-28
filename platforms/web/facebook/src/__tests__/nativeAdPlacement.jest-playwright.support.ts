import {expect} from "@jest/globals";
import {expect as expectBrowser, type Page, type Route} from "@playwright/test";
import {openRewardedLoss, type FacebookSubscriptionFixture} from "./rewardedContinue.jest-playwright.support";

/** Replays the native host's inherited methods and absent placement metadata through the real loss UI. */
export async function verifyNativeAdPlacement(page: Page, origin: string, subscription: FacebookSubscriptionFixture): Promise<void> {
  await page.goto("about:blank");
  const browserStorage = await page.context().newCDPSession(page);
  try {
    await browserStorage.send("Storage.clearDataForOrigin", {origin, storageTypes: "all"});
  } finally {await browserStorage.detach();}
  let claims = 0;
  const grant = async (route: Route) => {
    claims++;
    const headers = await route.request().allHeaders();
    expect(route.request().method()).toBe("POST");
    expect(Boolean(headers.authorization?.startsWith("Bearer "))).toBe(true);
    expect(Boolean(headers["x-firebase-appcheck"])).toBe(true);
    expect(await page.evaluate(() => (Reflect.get(window, "__nativeAdPlacementEvents") as string[]).includes("complete"))).toBe(true);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {newCoins: 300}})});
  };
  await page.route("**/grantFacebookRewardedContinue", grant);
  try {
    subscription.respondWith(false);
    await openRewardedLoss(page, origin, true);
    const balance = await page.locator(".continue-balance span").innerText();
    expect(balance).toBe("300");
    await page.evaluate(() => {
      const events: string[] = [];
      Reflect.set(window, "__nativeAdPlacementEvents", events);
      class NativeAd {
        getPlacementID() {events.push("placement:undefined"); return undefined;}
        async loadAsync() {events.push("load");}
        async showAsync() {
          events.push("show");
          await new Promise<void>(resolve => Reflect.set(window, "__finishNativePlacementAd", () => {
            Reflect.deleteProperty(window, "__finishNativePlacementAd");
            resolve();
          }));
          events.push("complete");
        }
      }
      // The observed native result differs from the documented string return type.
      Reflect.set(window.FBInstant!, "getRewardedVideoAsync", async (placement: string) => {
        events.push(`create:${placement}`);
        const ad = new NativeAd();
        events.push(`inherited:${["getPlacementID", "loadAsync", "showAsync"].every(name => !Object.hasOwn(ad, name))}`);
        return ad;
      });
    });
    const events = () => page.evaluate(() => Reflect.get(window, "__nativeAdPlacementEvents") as string[]);
    await page.locator(".loss-video-action").click();
    await expectBrowser.poll(events, {timeout: 5000}).toContain("show");
    expect((await events()).filter(event => event.startsWith("create:"))).toEqual(["create:browser-rewarded-placement"]);
    expect(await events()).toContain("inherited:true");
    expect(await events()).toContain("placement:undefined");
    expect(claims).toBe(0);
    expect(await page.locator(".loss-video-action").isDisabled()).toBe(true);
    expect(await page.locator(".continue-balance span").innerText()).toBe(balance);
    await page.evaluate(() => Reflect.get(window, "__finishNativePlacementAd")());
    await page.locator(".modal-continue").waitFor({state: "detached"});
    expect(claims).toBe(1);
    expect((await events()).filter(event => ["load", "show", "complete"].includes(event))).toEqual(["load", "show", "complete"]);
    expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe(balance);
    expect(await page.locator(".guess-row:first-child .cell:not(:disabled)").count()).toBe(5);
    expect(await page.locator(".guess-row .cell.red").count()).toBe(0);
    await page.locator(".keyboard").getByRole("button", {name: "P", exact: true}).click();
    expect(await page.locator(".guess-row:first-child .cell").first().innerText()).toBe("P");
    expect(claims).toBe(1);
  } finally {
    await page.unroute("**/grantFacebookRewardedContinue", grant);
  }
}
