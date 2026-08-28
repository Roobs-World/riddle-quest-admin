import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Provides advance to registration behavior. */
export const advanceToRegistration = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  await page.getByText("Keep your progress", {exact: true}).waitFor();
  expect(await page.locator(".onboarding-progress").textContent()).toBe("3/3");
  expect(await page.getByRole("button", {name: /^register$/i}).isVisible()).toBe(true);
  expect(await page.getByRole("button", {name: /^log in$/i}).isVisible()).toBe(true);
  expect(await page.getByRole("button", {name: /play as guest/i}).isVisible()).toBe(true);
};

/** Provides enter registered game behavior. */
export const enterRegisteredGame = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
  await page.waitForTimeout(500);
  for (let step = 0; step < 5; step += 1) {
    /** Provides tooltip button behavior. */
    const tooltipButton = page.locator(".tooltip-backdrop").getByRole("button", {name: /got it/i});
    if ((await tooltipButton.count()) === 0 || !(await tooltipButton.isVisible())) break;
    /** Provides tooltip behavior. */
    const tooltip = page.locator(".tooltip-card");
    /** Provides tooltip title behavior. */
    const tooltipTitle = await tooltip.getByRole("heading").innerText();
    /** Provides target tooltip behavior. */
    const targetTooltip = /use a hint/i.test(tooltipTitle)
      ? "gameHint"
      : /submit your answer/i.test(tooltipTitle)
        ? "submitAnswer"
        : /skip level/i.test(tooltipTitle)
          ? "gameSkip"
          : null;
    if (targetTooltip) {
      /** Provides [tooltip box, target button box] behavior. */
      const [tooltipBox, targetButtonBox] = await Promise.all([
        tooltip.boundingBox(),
        page.locator(`[data-tooltip='${targetTooltip}']`).boundingBox(),
      ]);
      expect(tooltipBox).not.toBeNull();
      expect(targetButtonBox).not.toBeNull();
      expect(tooltipBox!.y + tooltipBox!.height).toBeLessThan(targetButtonBox!.y);
    }
    await tooltipButton.click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached", timeout: 5_000});
};

/** Provides open profile after guidance behavior. */
export const openProfileAfterGuidance = async (page: Page) => {
  await page.getByRole("button", {name: /^profile$/i}).click();
  await page
    .locator("#game-modal-title")
    .getByText(/^profile$/i)
    .waitFor();
  /** Provides tooltip behavior. */
  const tooltip = page.locator(".tooltip-card");
  await tooltip.waitFor({state: "visible", timeout: 1_000}).catch(() => undefined);
  for (let step = 0; step < 8 && (await tooltip.isVisible()); step += 1) {
    await tooltip.getByRole("button", {name: /got it/i}).click();
  }
  await tooltip.waitFor({state: "detached", timeout: 5_000});
};

/** Provides fake race answers behavior. */
const fakeRaceAnswers = ["piano", "clock", "towel", "bottle", "stamp", "needle", "name", "comb", "water", "book"];

/** Provides solve fake race behavior. */
export const solveFakeRace = async (
  page: Page,
  options: {
    /** Stores expect chained submit loader. */
    expectChainedSubmitLoader?: boolean;
  } = {},
) => {
  for (const answer of fakeRaceAnswers) {
    /** Provides board behavior. */
    const board = page.locator(".race-gameplay .guess-board");
    /** Provides heading behavior. */
    const heading = page.locator(".race-riddle-surface .riddle-card h2");
    /** Provides previous riddle behavior. */
    const previousRiddle = await heading.innerText();
    await board.waitFor({state: "visible"});
    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>(".race-gameplay .keyboard .key")?.disabled,
    );
    await board.click();
    await page.keyboard.type(answer);
    /** Provides submit behavior. */
    const submit = page.locator(".race-actions .submit-action");
    await submit.waitFor({state: "visible"});
    try {
      await page.waitForFunction(
        () => {
          /** Provides button behavior. */
          const button = document.querySelector<HTMLButtonElement>(".race-actions .submit-action");
          return button && !button.disabled;
        },
        undefined,
        {timeout: 5_000},
      );
    } catch {
      /** Provides state behavior. */
      const state = await page.locator(".race-gameplay").evaluate((gameplay) => ({
        clue: gameplay.querySelector(".riddle-card h2")?.textContent,
        answer: Array.from(gameplay.querySelectorAll(".guess-row:last-child .cell"), (cell) => cell.textContent).join(
          "",
        ),
        activeElement: document.activeElement?.tagName,
        submitDisabled: (document.querySelector(".race-actions .submit-action") as HTMLButtonElement | null)?.disabled,
      }));
      throw new Error(`Race solver could not submit ${answer}: ${JSON.stringify(state)}`);
    }
    await submit.click({timeout: 5_000});
    /** Submits loader. */
    const submitLoader = page.locator(".race-operation-loader");
    /** Loads er visible. */
    const loaderVisible = submitLoader.waitFor({state: "visible", timeout: 1_000});
    if (answer === "book" && options.expectChainedSubmitLoader) await loaderVisible;
    else await loaderVisible.catch(() => undefined);
    if (answer !== "book") {
      await Promise.all([
        page.waitForFunction(
          (previous) => document.querySelector(".race-riddle-surface .riddle-card h2")?.textContent !== previous,
          previousRiddle,
        ),
        submitLoader.waitFor({state: "detached"}),
      ]);
    } else if (options.expectChainedSubmitLoader) {
      await page.waitForTimeout(250);
      expect(await submitLoader.isVisible()).toBe(true);
    }
  }
  await page.getByRole("heading", {name: /run recorded|you win|opponent wins|tie/i}).waitFor({timeout: 15_000});
  await page.locator(".race-operation-loader").waitFor({state: "detached"});
};
