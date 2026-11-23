import type {Page} from "@playwright/test";
import {createGuidanceStorageKey, createTooltipTourStorageKey} from "../../../../onboarding/browser/guidanceConfig";

/** Dismisses current gameplay and coin-shop guidance only for focused fixtures that skip the tour. */
export async function installCompletedMockGameTour(page: Page): Promise<void> {
  await page.addInitScript(({tourKey, coinKey}) => {
    localStorage.setItem(tourKey, "seen");
    localStorage.setItem(coinKey, "seen");
  }, {
    tourKey: createTooltipTourStorageKey("gameTour", "jest-guest"),
    coinKey: createGuidanceStorageKey("tooltipSeen:gameCoins", "jest-guest"),
  });
}

/** Completes the platform-owned onboarding flow before a focused mock-harness scenario. */
export async function completeMockOnboarding(page: Page): Promise<void> {
  /** Welcome action, clicked once the card's entrance animation has settled. */
  const play = page.getByRole("button", {name: /let's play/i});
  await play.waitFor();
  // A loaded machine can stretch the 420 ms entrance well past the action timeout.
  await page.locator(".onboarding-card").first().evaluate((card) =>
    Promise.all(card.getAnimations({subtree: true}).map((animation) => animation.finished.catch(() => undefined))));
  await play.click();
  await page
    .locator(".onboarding-card")
    .getByRole("button", {name: /got it/i})
    .click();
  await page.locator(".onboarding-card").waitFor({state: "hidden"});
}

/** Waits for provisional Next while authority is held and no coins are granted. */
export async function prepareProvisionalNextLevel(page: Page): Promise<void> {
  await page.locator(".modal-victory").waitFor({timeout: 2_000});
  if (await page.locator(".modal-victory .reward-chest").count()) throw new Error("Unconfirmed play granted coins");
  await page.getByRole("button", {name: /next level/i}).waitFor();
}
