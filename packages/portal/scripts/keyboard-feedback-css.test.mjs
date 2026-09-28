import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {chromium} from "@playwright/test";

test("scored keyboard keys use the same background as their board tiles on phones", async () => {
  const styles = await Promise.all(
    ["styles.foundation.css", "styles.shared-ui.css", "styles.puzzle.css", "styles.guidance.css", "styles.race-gameplay.css"].map((file) =>
      readFile(new URL(`../src/${file}`, import.meta.url), "utf8"),
    ),
  );
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    for (const surface of ["game-content", "race-gameplay"]) {
      await page.setContent(`
      <style>${styles.join("\n")}</style>
      <main class="${surface}">
        <div class="guess-board"><div class="guess-row">
          <button class="cell green">S</button>
          <button class="cell yellow">G</button>
          <button class="cell red">R</button>
        </div></div>
        <section class="keyboard"><div>
          <button class="key green">S</button>
          <button class="key yellow">G</button>
          <button class="key red">R</button>
          <button class="key">T</button>
        </div></section>
      </main>
    `);
      const backgrounds = await page.evaluate(() => {
        const background = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
        return ["green", "yellow", "red"].map((state) => ({
          state,
          board: background(`.cell.${state}`),
          keyboard: background(`.key.${state}`),
        }));
      });
      for (const {state, board, keyboard} of backgrounds) {
        assert.equal(keyboard, board, `${surface}: ${state} keyboard key should match its tile`);
      }
    }
  } finally {
    await browser.close();
  }
});
