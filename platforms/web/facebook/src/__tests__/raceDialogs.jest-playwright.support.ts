import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";
import {RACE_CHALLENGE_TTL_MS, type ListFacebookContextBoardResponse} from "../../../../../src/races/contracts/index";

/** Supplies valid server-window semantics to immediate and deliberately held context responses. */
export function createRaceContextBoardFixture(locale: ListFacebookContextBoardResponse["locale"], adjustedTimeMs: number): ListFacebookContextBoardResponse {
  /** One clock sample anchors both endpoints of the weekly fixture window. */
  const startsAtMs = Date.now() - 1000;
  /** The same current-player standing appears in the rows and summary. */
  const currentPlayer = {rank: 1, adjustedTimeMs, isCurrentPlayer: true};
  return {locale, startsAtMs, endsAtMs: startsAtMs + RACE_CHALLENGE_TTL_MS,
    sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false, standings: [currentPlayer], currentPlayer};
}

/** Installs controlled provider context dialogs behind the actual HTML5 SDK adapter. */
export async function installRaceContextDialogs(page: Page, nativeMatching = true, deliverContextEvents = true, contextChallenges = false): Promise<void> {
  await page.route("**/joinFacebookContext", async route => {
    await page.evaluate(value => Reflect.set(window, "__contextMembershipRequest", value), route.request().postDataJSON().data);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {}})});
  });
  await page.route("**/leaveFacebookContext", async route => {
    await page.evaluate(value => Reflect.set(window, "__contextLeaveRequest", value), route.request().postDataJSON().data);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {}})});
  });
  await page.route("**/listFacebookContextBoard", async route => {
    /** Actual requested context identifies the standings source independently of the UI. */
    const request = route.request().postDataJSON().data;
    await page.evaluate(value => Reflect.set(window, "__contextBoardRequest", value), request);
    /** New context has visibly distinct identity-free standings. */
    const adjustedTimeMs = request.contextId === "context-external" ? 4500 : request.contextId === "context-new" ? 2000 : 9000;
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: createRaceContextBoardFixture(request.locale, adjustedTimeMs)})});
  });
  await page.addInitScript(({nativeMatching, deliverContextEvents, contextChallenges}) => {
    /** Extend the existing SDK fixture while preserving identity and profile overlay contracts. */
    const sdk = window.FBInstant!;
    /** Preserve the capability inventory before enabling controlled context selection. */
    const supported = sdk.getSupportedAPIs.bind(sdk);
    sdk.getSupportedAPIs = () => [...supported().filter(api => api !== "matchPlayerAsync"), "context.chooseAsync",
      ...(nativeMatching ? ["matchPlayerAsync"] : []), ...(contextChallenges ? ["updateAsync"] : [])];
    if (contextChallenges) {
      Reflect.set(window, "__contextUpdates", []);
      sdk.updateAsync = async payload => {Reflect.get(window, "__contextUpdates").push({payload, contextId: sdk.context.getID()});};
    }
    if (nativeMatching) sdk.matchPlayerAsync = async (tag, switchContext, offlineMatch) => {
      if (tag && !/^[A-Za-z0-9_]{1,100}$/u.test(tag)) throw new Error("Meta match tag rejected");
      Reflect.set(window, "__matchPlayerRequest", {tag, switchContext, offlineMatch});
    };
    else delete sdk.matchPlayerAsync;
    Object.assign(window, {__contextDialogCalls: 0, __contextId: "context-old", __contextType: "GROUP"});
    /** The SDK state changes even when no game callback has been registered. */
    let contextChanged: ((contextId: string | null) => void) | undefined;
    sdk.onContextChange = success => {if (deliverContextEvents) contextChanged = success;};
    Reflect.set(window, "__emitContextChange", (contextId: string | null, contextType = "GROUP") => {
      Reflect.set(window, "__contextId", contextId); Reflect.set(window, "__contextType", contextType); contextChanged?.(contextId);
    });
    sdk.context = {
      getID: () => Reflect.get(window, "__contextId"),
      getType: () => Reflect.get(window, "__contextType"),
      chooseAsync: () => {
        Reflect.set(window, "__contextDialogCalls", Reflect.get(window, "__contextDialogCalls") + 1);
        return new Promise<void>((resolve, reject) => {
          Reflect.set(window, "__finishContextDialog", (success: boolean, cancelled = false) => {
            if (success) {
              Reflect.set(window, "__contextId", "context-new");
              Reflect.get(window, "__emitContextChange")?.("context-new"); resolve();
            }
            else reject(cancelled ? {code: "USER_INPUT"} : new Error("old-context-dialog-failure"));
          });
        });
      },
    };
  }, {nativeMatching, deliverContextEvents, contextChallenges});
}

/** Exercises repeated clicks, stale failure after reentry and accepted context cache replacement. */
export async function verifyRaceContextDialogs(page: Page, screenshotPath = "/tmp/race-context-dialog-recovery.png"): Promise<void> {
  await page.locator('[role="tab"]').nth(1).click();
  /** Context button uses the actual translated provider action. */
  const choose = page.locator(".race-hub-social-actions button").last();
  await choose.waitFor({timeout: 5000});
  try {await page.locator(".race-context-board li").waitFor();}
  catch {
    /** Browser diagnostics distinguish capability synchronization from response validation failures. */
    const diagnostics = await page.evaluate(() => ({body: document.body.innerText, context: Reflect.get(window, "__contextId"),
      boardRequest: Reflect.get(window, "__contextBoardRequest"), membershipRequest: Reflect.get(window, "__contextMembershipRequest"), locale: localStorage.getItem("appLanguage")}));
    await page.screenshot({path: "/tmp/race-context-dialog-failure.png"});
    throw new Error(`Context standings unavailable: ${JSON.stringify(diagnostics)}`);
  }
  expect(await page.locator(".race-context-board").innerText()).toContain("0:09.0");
  expect(await page.locator("[data-platform-owned-identity]").count()).toBe(1);
  await page.waitForFunction(() => window.__facebookEvents.includes("overlay:picture:show") && window.__facebookEvents.includes("overlay:name:show"));
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
  /** Native overlay switches must update an already mounted board without a chooser roundtrip. */
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")?.("context-external", "THREAD"));
  expect(await page.evaluate(() => Reflect.get(window, "__contextId"))).toBe("context-external");
  await page.waitForFunction(() => document.querySelector(".race-context-board")?.textContent?.includes("0:04.5"), {timeout: 5000});
  expect(await page.locator(".race-context-board").innerText()).not.toContain("0:02.0");
  expect(await page.evaluate(() => Reflect.get(window, "__contextMembershipRequest"))).toEqual({contextId: "context-external", contextType: "THREAD", locale: "fr"});
  expect(await page.evaluate(() => Reflect.get(window, "__contextLeaveRequest"))).toEqual({contextId: "context-new"});
  expect(await page.evaluate(() => Reflect.get(window, "__contextDialogCalls"))).toBe(2);
  /** A held previous-context response must never overwrite the next native selection. */
  /** Owns the deliberately delayed context response. */
  let releaseOld!: () => Promise<void>;
  /** Owns the deliberately delayed context response. */
  let markOldRead!: () => void;
  /** Owns the deliberately delayed context response. */
  const oldRead = new Promise<void>(resolve => {markOldRead = resolve;});
  await page.route("**/listFacebookContextBoard", async route => {
      /** Owns the deliberately delayed context response. */
      const request = route.request().postDataJSON().data;
      if (request.contextId !== "context-slow") {await route.fallback(); return;}
      releaseOld = async () => {
        await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: createRaceContextBoardFixture(request.locale, 27000)})});
      };
      markOldRead();
  });
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("context-slow")); await oldRead;
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("context-external", "THREAD"));
  await page.waitForFunction(() => document.querySelector(".race-context-board")?.textContent?.includes("0:04.5"));
  /** Owns the deliberately delayed context response. */
  const oldResponse = page.waitForResponse(response => response.url().endsWith("listFacebookContextBoard") && response.request().postDataJSON().data.contextId === "context-slow");
  await releaseOld(); await (await oldResponse).finished();
  expect(await page.locator(".race-context-board").innerText()).not.toContain("0:27.0");
  /** Returning to solo clears rendered rows and removes the prior membership. */
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")(null, "SOLO"));
  await page.waitForFunction(() => !document.querySelector(".race-context-board"));
  await page.waitForFunction(() => Reflect.get(window, "__contextLeaveRequest")?.contextId === "context-external");
  /** A normal solo session has no context standings and must not display a transport-retry error. */
  await page.waitForFunction(() => !document.querySelector(".race-context-panel"), {timeout: 5000});
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.screenshot({path: screenshotPath.replace(/\.png$/u, "-solo.png")});
  /** Reopening Activity in the same solo context remains an ordinary empty view. */
  await page.getByRole("tab").first().click(); await page.getByRole("tab").nth(1).click();
  await page.waitForFunction(() => !document.querySelector(".race-context-panel"));
  expect(await page.getByRole("alert").count()).toBe(0);
  /** Session-wide observation also reconciles changes while the activity view is unmounted. */
  await page.getByRole("tab").first().click();
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("context-external", "THREAD"));
  await page.waitForFunction(() => Reflect.get(window, "__contextMembershipRequest")?.contextId === "context-external");
  await page.getByRole("tab").nth(1).click();
  await page.waitForFunction(() => document.querySelector(".race-context-board")?.textContent?.includes("0:04.5"));
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".race-coin-balance img")]
    .every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({path: screenshotPath});
  await page.getByRole("tab").first().click();
  expect(await page.locator("[data-platform-owned-identity]").count()).toBe(0);
  await page.waitForFunction(() => ["picture", "name"].every(kind =>
    window.__facebookEvents.filter(event => event === `overlay:${kind}:true`).length ===
    window.__facebookEvents.filter(event => event === `overlay:${kind}:destroy`).length));
}
