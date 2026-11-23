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
