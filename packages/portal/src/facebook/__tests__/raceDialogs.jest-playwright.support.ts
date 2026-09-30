import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Installs controlled provider context dialogs behind the actual HTML5 SDK adapter. */
export async function installRaceContextDialogs(page: Page): Promise<void> {
  await page.route("**/joinFacebookContext", async route => {
    await page.evaluate(value => Reflect.set(window, "__contextMembershipRequest", value), route.request().postDataJSON().data);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {}})});
  });
  await page.route("**/leaveFacebookContext", route => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {}})}));
  await page.route("**/listFacebookContextBoard", async route => {
    /** Actual requested context identifies the standings source independently of the UI. */
    const request = route.request().postDataJSON().data;
    await page.evaluate(value => Reflect.set(window, "__contextBoardRequest", value), request);
    /** New context has visibly distinct identity-free standings. */
    const currentPlayer = {rank: 1, adjustedTimeMs: request.contextId === "context-new" ? 2000 : 9000, isCurrentPlayer: true};
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {
      locale: request.locale, startsAtMs: 0, endsAtMs: 604800000, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
      standings: [currentPlayer], currentPlayer,
    }})});
  });
  await page.addInitScript(() => {
    /** Extend the existing SDK fixture while preserving identity and profile overlay contracts. */
    const sdk = window.FBInstant!;
    /** Preserve the capability inventory before enabling controlled context selection. */
    const supported = sdk.getSupportedAPIs.bind(sdk);
    sdk.getSupportedAPIs = () => [...supported(), "context.chooseAsync", "context.matchPlayerAsync"];
    Object.assign(window, {__contextDialogCalls: 0, __contextId: "context-old"});
    sdk.context = {
      getID: () => Reflect.get(window, "__contextId"),
      getType: () => "GROUP",
      chooseAsync: () => {
        Reflect.set(window, "__contextDialogCalls", Reflect.get(window, "__contextDialogCalls") + 1);
        return new Promise<void>((resolve, reject) => {
          Reflect.set(window, "__finishContextDialog", (success: boolean) => {
            if (success) {Reflect.set(window, "__contextId", "context-new"); resolve();}
            else reject(new Error("old-context-dialog-failure"));
          });
        });
      },
      matchPlayerAsync: async () => undefined,
    };
  });
}

/** Exercises repeated clicks, stale failure after reentry and accepted context cache replacement. */
export async function verifyRaceContextDialogs(page: Page): Promise<void> {
  /** Context button uses the actual translated provider action. */
  const choose = page.locator(".race-hub-social-actions button").last();
  await choose.waitFor(); await page.locator('[role="tab"]').nth(1).click();
  try {await page.locator(".race-context-board li").waitFor();}
  catch {
    /** Browser diagnostics distinguish capability synchronization from response validation failures. */
    const diagnostics = await page.evaluate(() => ({body: document.body.innerText, context: Reflect.get(window, "__contextId"),
      boardRequest: Reflect.get(window, "__contextBoardRequest"), membershipRequest: Reflect.get(window, "__contextMembershipRequest"), locale: localStorage.getItem("appLanguage")}));
    await page.screenshot({path: "/tmp/race-context-dialog-failure.png"});
    throw new Error(`Context standings unavailable: ${JSON.stringify(diagnostics)}`);
  }
  expect(await page.locator(".race-context-board").innerText()).toContain("0:09.0");
  // Dispatch twice within one JavaScript task, before React can commit disabled controls.
  await choose.evaluate((button: HTMLElement) => {button.click(); button.click();});
  expect(await page.evaluate(() => Reflect.get(window, "__contextDialogCalls"))).toBe(1);
  await page.getByRole("tab").first().click(); await page.getByRole("tab").nth(1).click();
  await page.evaluate(() => Reflect.get(window, "__finishContextDialog")(false));
  await page.waitForFunction(() => !document.querySelector(".race-hub-social-actions button:last-child")?.hasAttribute("disabled"));
  expect(await page.getByRole("alert").count()).toBe(0);
  await choose.click();
  await page.evaluate(() => Reflect.get(window, "__finishContextDialog")(true));
  await page.waitForFunction(() => document.querySelector(".race-context-board")?.textContent?.includes("0:02.0"));
  expect(await page.locator(".race-context-board").innerText()).not.toContain("0:09.0");
  expect(await page.evaluate(() => Reflect.get(window, "__contextDialogCalls"))).toBe(2);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.screenshot({path: "/tmp/race-context-dialog-recovery.png"});
  await page.getByRole("tab").first().click();
}
