import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("hosted browser harness", () => {
  it("runs the guest hosted-wrapper flow through the iframe", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {readFile} = await import("node:fs/promises");
    const path = await import("node:path");

    const packageRoot = path.resolve(__dirname, "../../..");
    execFileSync("pnpm", ["--filter", "@qwordly/portal", "build"], {
      cwd: path.resolve(packageRoot, "../.."),
      stdio: "inherit",
    });

    const distDir = path.join(packageRoot, "dist");
    const contentTypes: Record<string, string> = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".map": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };

    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname.startsWith("/_vercel/")) {
        response.writeHead(204, {"Content-Type": "text/javascript; charset=utf-8"});
        response.end("");
        return;
      }

      const pathname = requestUrl.pathname.replace(/^\/riddle-quest\//u, "/");
      const candidate = path.join(distDir, pathname === "/" ? "index.html" : pathname);
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");

      try {
        const body = await readFile(filePath);
        response.writeHead(200, {
          "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
        });
        response.end(body);
      } catch {
        if (path.extname(candidate)) {
          response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
          response.end("Not found");
          return;
        }

        response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        response.end(await readFile(path.join(distDir, "index.html")));
      }
    });

    await new Promise<void>((resolve) => server.listen(4178, "127.0.0.1", resolve));
    const browser = await chromium.launch({headless: true});

    try {
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto("http://127.0.0.1:4178/riddle-quest/play/?harness=jest");
      await page.getByRole("button", {name: /guest/i}).click();

      const frame = page.frameLocator("iframe.game-frame");
      await frame.getByText(/What has keys/i).waitFor({timeout: 15000});

      await frame.getByRole("button", {name: /coin shop/i}).click();
      await frame.getByRole("button", {name: /watch ad/i}).click();
      await frame.getByRole("button", {name: /close/i}).click();
      await frame.getByRole("button", {name: /hint/i}).click();

      for (const letter of ["I", "A", "N", "O"]) {
        await frame.getByRole("button", {name: letter, exact: true}).click();
      }

      await frame.getByRole("button", {name: /submit/i}).click();
      await frame.getByText(/nice job/i).waitFor({timeout: 15000});

      expect(consoleErrors).toEqual([]);
    } finally {
      await browser.close();
      server.close();
    }
  }, 120000);
});
