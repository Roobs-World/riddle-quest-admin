import {expect, it} from "@jest/globals";
import {readFileSync} from "node:fs";
import path from "node:path";

/** Production stylesheet that owns the game's action buttons. */
const stylesheet = readFileSync(path.resolve(__dirname, "../../styles.puzzle.css"), "utf8");

/** Returns the declaration block of the first rule whose selector list is exactly `selector`. */
function ruleBody(selector: string): string {
  /** Occurrence of the selector at the start of a line, ending its selector list. */
  let start = stylesheet.indexOf(`\n${selector} {`);
  // Skip occurrences that are the last entry of a longer, comma-separated selector list.
  while (start >= 0 && stylesheet.slice(0, start).trimEnd().endsWith(",")) {
    start = stylesheet.indexOf(`\n${selector} {`, start + 1);
  }
  expect(start).toBeGreaterThanOrEqual(0);
  /** Opening brace of the matched rule. */
  const open = stylesheet.indexOf("{", start);
  return stylesheet.slice(open + 1, stylesheet.indexOf("}", open));
}

it("styles the multiplayer entry as the game's shared primary action", () => {
  /** Declarations of the multiplayer entry. */
  const multiplayer = ruleBody(".game-bottom-navigation .multiplayer-navigation-action");
  /** Declarations of the primary Submit action it mirrors. */
  const submit = ruleBody(".game-input-actions .submit-action");

  expect(submit).toContain("background: var(--play-gold);");
  expect(multiplayer).toContain("background: var(--play-gold);");
  expect(multiplayer).toContain("color: var(--play-ink);");
  expect(multiplayer).toMatch(/border-radius: (\d+px);/);
  expect(multiplayer.match(/border-radius: (\d+px);/)?.[1]).toBe(
    ruleBody(".game-input-actions button").match(/border-radius: (\d+px);/)?.[1],
  );
  expect(multiplayer).toContain("box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);");
  expect(multiplayer).toContain('"Poetsen One"');
  expect(multiplayer).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

it("keeps the multiplayer hover on the shared token and motion", () => {
  /** Declarations of the multiplayer hover state. */
  const hover = ruleBody(".game-bottom-navigation .multiplayer-navigation-action:hover");

  expect(hover).toContain("background: var(--play-gold);");
  expect(hover).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  expect(stylesheet).toContain(
    ".game-input-actions button:hover:not(:disabled),\n.game-bottom-navigation .multiplayer-navigation-action:hover {",
  );
  expect(stylesheet).toContain(
    ".game-input-actions button:active:not(:disabled),\n.game-bottom-navigation .multiplayer-navigation-action:active {",
  );
});
