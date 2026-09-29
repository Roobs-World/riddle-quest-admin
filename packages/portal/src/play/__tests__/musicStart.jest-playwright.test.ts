import {describe, expect, it} from "@jest/globals";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {chromium} from "@playwright/test";
/** Runs the audio check only in the injected browser harness. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("Jest music startup", () => {
  it("starts the bundled music on the first Play tap", async () => {
    /** Serves the already-built Jest artifact for the interaction check. */
    const root = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../dist-jest");
    /** Minimal HTTP server for the already-built Jest artifact. */
    const server = createServer(async (request, response) => {
      /** Path requested by the browser. */
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      /** Local artifact path. */
      const file = path.join(root, pathname === "/" ? "index.html" : pathname);
      try {
        /** File content from the isolated Jest build. */
        const bytes = await readFile(file);
        /** MIME type required by the browser for the loaded asset. */
        const mime = file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".webm")
              ? "audio/webm"
              : "text/html";
        response.writeHead(200, {"Content-Type": mime});
        response.end(bytes);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** Local port chosen by the OS. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
    /** Browser used to exercise a real trusted click. */
    const browser = await chromium.launch({headless: true});
    try {
      /** Simulates a touch-enabled portrait Jest viewport. */
      const page = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await page.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await page.goto(`http://127.0.0.1:${address.port}/?harness=jest`);
      /** First action visible to a new player. */
      const play = page.getByRole("button", {name: /let's play/i});
      await play.waitFor({timeout: 15_000});
      expect(await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
      await play.tap();
      await page.waitForFunction(
        () => {
          /** Bundled background track. */
          const audio = document.querySelector("audio");
          return audio && !audio.paused && audio.currentTime > 0;
        },
        undefined,
        {timeout: 4_000},
      );
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
