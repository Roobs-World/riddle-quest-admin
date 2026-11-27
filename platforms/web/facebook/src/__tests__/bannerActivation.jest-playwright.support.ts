import {expect} from "@jest/globals";
import {expect as expectBrowser, type Page} from "@playwright/test";
import type {FacebookSubscriptionFixture} from "./rewardedContinue.jest-playwright.support";

/** Exercises activated Entry/banner/layout wiring with external Meta surface and entitlement fixtures. */
export async function verifyBannerActivation(page: Page, origin: string, subscription: FacebookSubscriptionFixture): Promise<void> {
  subscription.respondWith(false);
  await page.addInitScript(() => {
    if (new URL(location.href).searchParams.get("banner") !== "activation") return;
    const sdk = window.FBInstant!;
    const supported = sdk.getSupportedAPIs.bind(sdk);
    sdk.getSupportedAPIs = () => [...supported(), "loadBannerAdAsync", "hideBannerAdAsync"];
    const events: string[] = [];
    Reflect.set(window, "__bannerEvents", events);
    sdk.loadBannerAdAsync = async (placement, position) => {
      events.push(`load:${placement}:${position}`);
      if (Reflect.get(window, "__bannerNoFill")) {
        events.push("no-fill");
        throw Object.assign(new Error("No banner available"), {code: "ADS_NO_FILL"});
      }
      if (document.querySelector("[data-native-banner-fixture]")) throw new Error("An existing native banner was not hidden.");
      const surface = document.createElement("div");
      surface.dataset.nativeBannerFixture = "true";
      surface.textContent = "Meta banner fixture";
      surface.style.cssText = "position:fixed;bottom:0;left:0;width:100%;height:60px;z-index:9999;background:#30406b;color:white";
      document.body.append(surface);
      events.push("visible");
    };
    sdk.hideBannerAdAsync = async () => {
      events.push("hide:start");
      if (Reflect.get(window, "__holdBannerHide")) {
        await new Promise<void>(resolve => Reflect.set(window, "__finishBannerHide", () => {
          Reflect.deleteProperty(window, "__finishBannerHide");
          Reflect.set(window, "__holdBannerHide", false);
          resolve();
        }));
      }
      document.querySelector("[data-native-banner-fixture]")?.remove();
      events.push("hide:complete");
    };
    sdk.openExternalLinkAsync = async url => {
      events.push(document.querySelector("[data-native-banner-fixture]") ? "dialog:overlap" : `dialog:${url}`);
      await new Promise<never>((_resolve, reject) => Reflect.set(window, "__cancelBannerDialog", () => {
        Reflect.deleteProperty(window, "__cancelBannerDialog");
        reject({code: "USER_INPUT"});
      }));
    };
  });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`${origin}/?harness=race&banner=activation`);
  await page.locator(".game-bottom-navigation").waitFor();
  const onboarding = page.locator(".onboarding-card .play-primary");
  if (await onboarding.count()) {
    await onboarding.click();
    await page.locator(".onboarding-clues").waitFor();
    await onboarding.click();
    await onboarding.waitFor({state: "detached"});
  }
  for (let step = 0; step < 8; step++) {
    const tip = page.locator(".tooltip-backdrop");
    try {await tip.first().waitFor({timeout: 500});} catch {break;}
    await tip.first().locator("button").last().click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
  const layout = page.locator(".facebook-banner-layout");
  const nativeBanner = page.locator("[data-native-banner-fixture]");
  await expectBrowser(layout).toHaveCount(1);
  await expectBrowser(nativeBanner).toHaveCount(0);

  // The real Settings surface must fit above the external provider's reserved area.
  await page.locator(".game-bottom-navigation button").first().click();
  const settings = page.locator(".modal-settings");
  await settings.waitFor();
  const language = settings.getByRole("combobox");
  if (await language.inputValue() !== "en") {
    await language.selectOption("en");
    await settings.waitFor({state: "detached"});
    await page.locator(".game-bottom-navigation button").first().click();
    await settings.waitFor();
  }
  const privacy = settings.getByRole("button", {name: "Privacy Policy", exact: true});
  await privacy.waitFor();
  await nativeBanner.waitFor();
  await expectBrowser.poll(async () => {
    const [panelBounds, layoutBounds, bannerBounds] = await Promise.all([
      settings.boundingBox(), layout.boundingBox(), nativeBanner.boundingBox(),
    ]);
    return Boolean(panelBounds && layoutBounds && bannerBounds &&
      panelBounds.y + panelBounds.height <= bannerBounds.y + 1 &&
      layoutBounds.y + layoutBounds.height <= bannerBounds.y + 1);
  }).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, "__bannerEvents")))
    .toContain("load:browser-banner-placement:bottom");

  // Native link admission must wait for a real hide acknowledgment, even while hide is pending.
  await page.evaluate(() => {
    Reflect.get(window, "__bannerEvents").length = 0;
    Reflect.set(window, "__holdBannerHide", true);
  });
  await privacy.click();
  await page.waitForFunction(() => typeof Reflect.get(window, "__finishBannerHide") === "function");
  await expectBrowser(page.locator(".facebook-banner-content[inert]")).toHaveCount(1);
  await expectBrowser(nativeBanner).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, "__bannerEvents"))).toEqual(["hide:start"]);
  await page.evaluate(() => Reflect.get(window, "__finishBannerHide")());
  await page.waitForFunction(() => typeof Reflect.get(window, "__cancelBannerDialog") === "function");
  await expectBrowser(nativeBanner).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__bannerEvents"))).toEqual([
    "hide:start", "hide:complete", "dialog:https://roobsworld.com/riddle-quest/privacy",
  ]);
  await page.evaluate(() => Reflect.get(window, "__cancelBannerDialog")());
  await expectBrowser(privacy).toBeEnabled();
  await nativeBanner.waitFor();

  await settings.locator(".modal-x").click();
  await settings.waitFor({state: "detached"});
  await expectBrowser(nativeBanner).toHaveCount(0);
  await expectBrowser(page.locator(".facebook-banner-content[inert]")).toHaveCount(0);
  await expectBrowser(layout).not.toHaveAttribute("data-banner-reserved", "true");
  await page.locator(".keyboard").getByRole("button", {name: "A", exact: true}).click();

  // A provider no-fill response releases space and leaves ordinary Settings/gameplay controls usable.
  await page.evaluate(() => {
    Reflect.get(window, "__bannerEvents").length = 0;
    Reflect.set(window, "__bannerNoFill", true);
  });
  await page.locator(".game-bottom-navigation button").first().click();
  await settings.waitFor();
  await page.waitForFunction(() => Reflect.get(window, "__bannerEvents").includes("no-fill"));
  await expectBrowser(nativeBanner).toHaveCount(0);
  await expectBrowser(layout).not.toHaveAttribute("data-banner-reserved", "true");
  await expectBrowser(page.locator(".facebook-banner-content[inert]")).toHaveCount(0);
  await expectBrowser(privacy).toBeEnabled();
  await settings.locator(".modal-x").click();
  await settings.waitFor({state: "detached"});
  await page.locator(".keyboard").getByRole("button", {name: "B", exact: true}).click();
}
