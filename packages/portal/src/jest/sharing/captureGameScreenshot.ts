import html2canvas from "html2canvas-pro";

/** Captures the isolated app viewport, including visible game and Jest session dialogs. */
export async function captureGameScreenshot(): Promise<string | null> {
  /** An empty or detached game has no player-visible screen to share. */
  const game = document.querySelector<HTMLElement>(".game-app");
  if (!game?.isConnected || !game.textContent?.trim()) return null;
  /** The app root also contains sibling Jest registration dialogs. */
  const surface = game.closest<HTMLElement>("#root") ?? game;
  /** Clip horizontal pixels to the smaller app and browser viewport. */
  const width = Math.min(surface.clientWidth, window.innerWidth);
  /** Clip vertical pixels so offscreen app content stays private. */
  const height = Math.min(surface.clientHeight, window.innerHeight);
  if (width < 1 || height < 1) return null;

  await document.fonts.ready;
  if (!game.isConnected) return null;

  /** The captured canvas remains the source for each size-reduction step. */
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
    /** The provider limit includes the complete encoded data URL. */
    const image = canvas.toDataURL("image/png");
    if (image.length <= 2 * 1024 * 1024) return image;
    if (canvas.width <= 1 || canvas.height <= 1) return null;
    /** Shrink rendered pixels while retaining the captured game content. */
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.floor(canvas.width * 0.75));
    smaller.height = Math.max(1, Math.floor(canvas.height * 0.75));
    /** A missing canvas context cancels capture instead of inventing an image. */
    const context = smaller.getContext("2d");
    if (!context) return null;
    context.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
}
