import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Checks the real target UI while withholding confirmation of its piano fixture. */
export async function verifyImmediateSoloFeedback(page: Page, target: string): Promise<void> {
  for (const letter of "CRANE") {
    await page.locator(".keyboard").getByRole("button", {name: new RegExp(`^${letter}$`)}).click();
  }
  await page.evaluate(() => {
    /** Captures responses before any bridge listener can consume them. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event: Event) => {
      if (event.type === "riddle-quest:host-to-game" && (event as CustomEvent).detail?.payload?.operation === "guess") {
        Reflect.set(window, "__soloGuessResponse", (event as CustomEvent).detail);
        return true;
      }
      return dispatch(event);
    };
    Reflect.set(window, "__releaseSoloGuess", () => {
      window.dispatchEvent = dispatch;
      dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, "__soloGuessResponse")}));
    });
  });
  /** Measures feedback rendering without an available server response. */
  const latency = await page.locator(".submit-action").evaluate(async (button) => {
    /** Browser clock immediately before the actual submit handler. */
    const started = performance.now();
    (button as HTMLButtonElement).click();
    while (document.querySelectorAll(".guess-row:first-child .cell.red").length !== 3) {
      if (performance.now() - started > 1000) throw new Error("Feedback waited for server confirmation");
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return performance.now() - started;
  });
  expect(latency).toBeLessThan(250);
  await page.locator("[data-tooltip-id=hintAfterWrongGuess] button").click();
  await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
  expect(await page.locator(".guess-row").nth(1).locator(".cell").first().textContent()).toBe("P");
  await page.waitForFunction(() => Reflect.has(window, "__soloGuessResponse"));
  await page.evaluate(async () => {
    Reflect.get(window, "__releaseSoloGuess")();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  expect(await page.locator(".guess-row").nth(1).locator(".cell").first().textContent()).toBe("P");
  expect(await page.locator(".guess-row:first-child .cell.green").count()).toBe(2);
  console.info(`${target}: feedback ${latency.toFixed(1)}ms; next draft survives confirmation`);
}
