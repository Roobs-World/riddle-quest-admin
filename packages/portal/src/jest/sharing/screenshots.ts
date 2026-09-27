import type {ScreenshotProvider} from "../types";

/** Jest limits the entire ASCII data URL, including its prefix and base64 overhead. */
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

/** Provides size checked screenshot provider behavior. */
export function sizeCheckedScreenshotProvider(provider: ScreenshotProvider): ScreenshotProvider {
  return async () => {
    /** Provides result behavior. */
    const result = await provider();
    if (!result) return null;
    if (!/^data:image\/png;base64,/.test(result)) return null;
    return result.length <= MAX_SCREENSHOT_BYTES ? result : null;
  };
}

/** Captures game screenshot. */
export function captureGameScreenshot(): string | null {
  /** Provides game behavior. */
  const game = document.querySelector<HTMLElement>(".game-app");
  if (!game || !game.textContent?.trim()) return null;
  /** Provides canvas behavior. */
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  /** Provides context behavior. */
  const context = canvas.getContext("2d");
  if (!context) return null;
  /** Provides gradient behavior. */
  const gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, "#142128");
  gradient.addColorStop(1, "#254e70");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 630);
  context.fillStyle = "#f4b83f";
  context.font = "700 54px system-ui, sans-serif";
  context.fillText("Riddle Quest", 72, 100);
  context.fillStyle = "#fffdf7";
  context.font = "32px system-ui, sans-serif";
  /** Provides words behavior. */
  const words = game.textContent.replace(/\s+/g, " ").trim().slice(0, 420).split(" ");
  /** Provides line behavior. */
  let line = "";
  /** Provides y behavior. */
  let y = 180;
  for (const word of words) {
    /** Provides candidate behavior. */
    const candidate = `${line}${line ? " " : ""}${word}`;
    if (context.measureText(candidate).width > 1040) {
      context.fillText(line, 72, y);
      line = word;
      y += 48;
      if (y > 550) break;
    } else line = candidate;
  }
  if (line && y <= 550) context.fillText(line, 72, y);
  return canvas.toDataURL("image/png");
}

/** Captures victory share image. */
export function captureVictoryShareImage(input: {
  /** Stores title. */
  title: string;
  /** Stores summary. */
  summary: string;
  /** Stores emoji grid. */
  emojiGrid: string;
}): string | null {
  /** Provides canvas behavior. */
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  /** Provides context behavior. */
  const context = canvas.getContext("2d");
  if (!context) return null;

  /** Provides gradient behavior. */
  const gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, "#132026");
  gradient.addColorStop(0.55, "#274f70");
  gradient.addColorStop(1, "#5a326d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#f4b83f";
  context.font = "700 56px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("Riddle Quest", 600, 92);

  context.fillStyle = "#fffdf7";
  context.font = "700 38px system-ui, sans-serif";
  context.fillText(input.title.slice(0, 80), 600, 158);
  context.font = "600 30px system-ui, sans-serif";
  context.fillText(input.summary.slice(0, 100), 600, 210);

  /** Provides rows behavior. */
  const rows = input.emojiGrid.split("\n").filter(Boolean).slice(-7);
  context.font = "48px system-ui, sans-serif";
  rows.forEach((row, index) => {
    context.fillText(row.slice(0, 24), 600, 290 + index * 52);
  });

  return canvas.toDataURL("image/png");
}
