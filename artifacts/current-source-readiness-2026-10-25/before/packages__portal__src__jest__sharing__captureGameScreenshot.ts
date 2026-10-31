import html2canvas from "html2canvas-pro";

/** Captures the isolated app viewport, including visible game and Jest session dialogs. */
export async function captureGameScreenshot(): Promise<string | null> {
  const game = document.querySelector<HTMLElement>(".game-app");
  if (!game?.isConnected || !game.textContent?.trim()) return null;
  const surface = game.closest<HTMLElement>("#root") ?? game;
  const width = Math.min(surface.clientWidth, window.innerWidth);
  const height = Math.min(surface.clientHeight, window.innerHeight);
  if (width < 1 || height < 1) return null;

  await document.fonts.ready;
  if (!game.isConnected) return null;

  let canvas = await html2canvas(surface, {
    width,
    height,
    scale: Math.min(1, 1600 / Math.max(width, height)),
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 5000,
    logging: false,
    ignoreElements: (node) => node.matches("script, audio, video, iframe, input[type=hidden], input[type=password], [data-screenshot-private]"),
  });

  // Jest limits the complete PNG data URL to 2 MiB. Reduce pixels without replacing the screen.
  for (;;) {
    const image = canvas.toDataURL("image/png");
    if (image.length <= 2 * 1024 * 1024) return image;
    if (canvas.width <= 1 || canvas.height <= 1) return null;
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.floor(canvas.width * 0.75));
    smaller.height = Math.max(1, Math.floor(canvas.height * 0.75));
    const context = smaller.getContext("2d");
    if (!context) return null;
    context.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
}
