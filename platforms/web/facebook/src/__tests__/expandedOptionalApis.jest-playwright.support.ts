import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Models optional Meta surfaces without granting manager consent or exposing profile fields. */
export async function installExpandedOptionalApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sdk = window.FBInstant!;
    const supported = sdk.getSupportedAPIs.bind(sdk);
    const generic = new URL(location.href).searchParams.get("generic-overlays") === "on";
    sdk.getSupportedAPIs = () => [...supported().filter(api => !generic || !api.startsWith("overlayViews.")),
      "player.isSubscribedBotAsync", "player.canSubscribeBotAsync", "player.subscribeBotAsync",
      ...(generic ? ["overlayViews.createOverlayViewAsync", "overlayViews.setCustomEventHandler", "overlayViews.getOverlayViews"] : [])];
    let subscribed = false;
    sdk.player.isSubscribedBotAsync = async () => {window.__facebookEvents.push(`bot:status:${subscribed}`); return subscribed;};
    sdk.player.canSubscribeBotAsync = async () => {window.__facebookEvents.push("bot:eligible"); return !subscribed;};
    sdk.player.subscribeBotAsync = async () => {window.__facebookEvents.push("bot:subscribe"); subscribed = true;};
    if (!generic) return;

    const inventory = new Map<string, import("../fbinstant").FacebookOverlayView>();
    let sequence = 0;
    Reflect.set(window, "__genericOverlayFiles", []);
    for (const field of ["getName", "getPhoto"]) Object.defineProperty(sdk.player, field,
      {get: () => {throw new Error("Raw Meta profile fields must not be read.");}});
    sdk.overlayViews = {
      setCustomEventHandler: callback => {Reflect.set(window, "__genericOverlayEvent", callback);},
      getOverlayViews: () => inventory,
      async createOverlayViewAsync(filename, surface, iframeStyle, _css, initialData) {
        if (Object.keys(initialData ?? {}).length) throw new Error("Profile data must remain in Meta bindings.");
        const response = await fetch(filename);
        if (!response.ok) throw new Error("Bundled overlay XML is missing.");
        const xml = await response.text();
        if (!xml.includes("{{FBInstant.player.name}}") || /<script|<iframe/iu.test(xml)) throw new Error("Unexpected profile template.");
        if (filename.endsWith("profile.xml") && (!xml.includes("{{FBInstant.player.photo}}") || !xml.includes('onErrorEvent="rq_profile_photo_error"')))
          throw new Error("The profile template lacks its native photo fallback event.");
        if (filename.endsWith("profile-name.xml") && xml.includes("{{FBInstant.player.photo}}"))
          throw new Error("The name fallback still requests a photo.");
        Reflect.get(window, "__genericOverlayFiles").push(filename);
        const id = `fixture-overlay-${++sequence}`;
        const frame = document.createElement("iframe");
        frame.dataset.fixtureOverlayFile = filename;
        frame.setAttribute("sandbox", "");
        frame.style.cssText = iframeStyle ?? "";
        frame.style.display = "none";
        frame.srcdoc = `<html><body style="margin:0;color:white;background:#161c37;font:600 16px sans-serif"><div style="display:flex;align-items:center;gap:8px;height:64px">${filename.endsWith("profile.xml") ? '<span aria-hidden="true" style="display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:#5669c4">M</span>' : ""}<span>Meta profile fixture</span></div></body></html>`;
        surface.append(frame);
        const view = {
          getID: () => id,
          getIFrameElement: () => frame,
          async showAsync() {frame.style.display = "block"; window.__facebookEvents.push(`generic:show:${id}`);},
          async dismissAsync() {frame.style.display = "none";},
          async destroyAsync() {frame.remove(); inventory.delete(id); window.__facebookEvents.push(`generic:destroy:${id}`);},
        };
        inventory.set(id, view);
        return view;
      },
    };
  });
}

/** Verifies the bundled generic profile, its scoped image fallback, and cleanup through real mounted UI. */
export async function verifyGenericProfileOverlay(page: Page, origin: string, evidenceDirectory: string): Promise<void> {
  await page.goto(`${origin}/?harness=race&generic-overlays=on`);
  await page.locator(".game-bottom-navigation").waitFor();
  const onboarding = page.locator(".onboarding-card .play-primary");
  if (await onboarding.count()) {
    await onboarding.click();
    await page.locator(".onboarding-clues").waitFor();
    await onboarding.click();
    await onboarding.waitFor({state: "detached"});
  }
  for (let step = 0; step < 4; step++) {
    const tip = page.locator(".tooltip-backdrop");
    if (await tip.count()) await tip.locator("button").click();
  }
  await page.locator(".multiplayer-navigation-action").click();
  await page.getByRole("tab", {name: "Activité", exact: true}).click();
  const profile = page.locator('[data-platform-owned-identity] iframe[data-fixture-overlay-file="facebook-overlays/profile.xml"]');
  await profile.waitFor();
  expect(await profile.getAttribute("title")).toBe("Profil");
  expect(await profile.getAttribute("tabindex")).toBe("-1");
  expect(await profile.evaluate(frame => frame.getBoundingClientRect().height)).toBe(64);
  expect(await page.locator("body").innerText()).not.toContain("Meta profile fixture");
  expect(await page.evaluate(() => Reflect.get(window, "__genericOverlayFiles"))).toEqual(["facebook-overlays/profile.xml"]);
  await page.screenshot({path: `${evidenceDirectory}/generic-profile-mobile.png`});
  await page.evaluate(() => Reflect.get(window, "__genericOverlayEvent")("rq_profile_photo_error", "unowned-overlay"));
  expect(await profile.count()).toBe(1);
  const ownedId = await page.evaluate(() => [...window.FBInstant!.overlayViews!.getOverlayViews!().keys()][0]);
  await page.evaluate(id => Reflect.get(window, "__genericOverlayEvent")("rq_profile_photo_error", id), ownedId);
  const fallback = page.locator('[data-platform-owned-identity] iframe[data-fixture-overlay-file="facebook-overlays/profile-name.xml"]');
  await fallback.waitFor();
  expect(await profile.count()).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, "__genericOverlayFiles")))
    .toEqual(["facebook-overlays/profile.xml", "facebook-overlays/profile-name.xml"]);
  await page.screenshot({path: `${evidenceDirectory}/generic-profile-name-fallback-mobile.png`});
  await page.locator(".race-close").click();
  await page.waitForFunction(() => window.FBInstant!.overlayViews!.getOverlayViews!().size === 0);
  expect(await page.locator("[data-platform-owned-identity] iframe").count()).toBe(0);
  expect(await page.evaluate(() => window.__facebookEvents.filter(event => event.startsWith("generic:destroy:")))).toHaveLength(2);
  await page.evaluate(id => Reflect.get(window, "__genericOverlayEvent")("rq_profile_photo_error", id), ownedId);
  expect(await page.evaluate(() => Reflect.get(window, "__genericOverlayFiles"))).toHaveLength(2);
}
