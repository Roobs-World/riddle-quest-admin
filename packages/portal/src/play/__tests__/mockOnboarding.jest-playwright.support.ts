import type {Page} from "@playwright/test";
/** Completes the platform-owned onboarding flow before a focused mock-harness scenario. */
export async function completeMockOnboarding(page: Page): Promise<void> {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page
    .locator(".onboarding-card")
    .getByRole("button", {name: /got it/i})
    .click();
  await page.locator(".onboarding-card").waitFor({state: "hidden"});
}

/** Advances projected celebration steps while authority is held and no coins are granted. */
export async function prepareProvisionalNextLevel(page: Page): Promise<void> {
  await page.locator(".modal-victory").waitFor({timeout: 2_000});
  for (let step = 0; step < 10 && (await page.getByRole("button", {name: /next level/i}).count()) === 0; step += 1) {
    /** Current projected celebration position. */
    const previous = await page.locator(".modal-victory .sequence-progress").textContent();
    if (await page.locator(".modal-victory .reward-chest").count()) throw new Error("Unconfirmed play granted coins");
    await page.locator(".modal-victory .reward-continue").click();
    await page.waitForFunction(prior => document.querySelector(".modal-victory .sequence-progress")?.textContent !== prior, previous);
  }
  await page.getByRole("button", {name: /next level/i}).waitFor();
}
