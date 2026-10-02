import {expect} from "@jest/globals";
import type {Browser, Page} from "@playwright/test";
import {createServer} from "node:http";

/** Private test state records native Fetch settlement without provider identifiers or payloads. */
type RedirectWindow = Window & {
  /** Final transport outcome for the actual bootstrapping API call. */
  __redditRedirectOutcome?: "fulfilled" | "rejected";
};

/** Proves the shipped browser adapter rejects redirects before attempting a second origin. */
export async function verifyRedditBrowserRedirects(
  browser: Browser,
  origin: string,
  inject: (page: Page, mode: 1 | 2, origin: string) => Promise<void>,
): Promise<void> {
  /** Counts requests actually received by a second loopback origin, including preflights. */
  let escapedRequests = 0;
  /** Real HTTP destination avoids mistaking browser CORS/DNS rejection for adapter isolation. */
  const destination = createServer((request, response) => {
    escapedRequests += 1;
    request.resume();
    response.writeHead(200, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json",
    }).end(JSON.stringify({ok: true, authenticated: false}));
  });
  await new Promise<void>((resolve, reject) => {
    destination.once("error", reject);
    destination.listen(0, "127.0.0.1", () => {destination.off("error", reject); resolve();});
  });
  /** Kernel-selected port distinguishes the destination from the game/API origin. */
  const address = destination.address();
  if (!address || typeof address === "string") throw new Error("browser-redirect-address-missing");
  /** Only suite-owned local HTTP servers receive synthetic requests. */
  const redirectUrl = `http://127.0.0.1:${address.port}/capture`;
  try {
    for (const status of [301, 302, 303, 307, 308]) {
      escapedRequests = 0;
      /** Each redirect begins a fresh game page and provider context. */
      const context = await browser.newContext();
      try {
        /** Real production HTML and JavaScript run inside this browser page. */
        const page = await context.newPage();
        /** Confirms that the built adapter actually reached its intended API route. */
        let initialRequests = 0;
        await inject(page, 2, origin);
        await page.route(`${origin}/api/session`, route => {
          initialRequests += 1;
          return route.fulfill({status, headers: {location: redirectUrl}});
        });
        await page.addInitScript(() => {
          /** Original native browser Fetch remains responsible for redirects and CORS. */
          const original = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            /** Only the first production bootstrap request is observed. */
            const observe = input === "/api/session";
            try {
              /** All caller options are preserved without emulating transport behavior. */
              const response = await original(input, init);
              if (observe) (window as RedirectWindow).__redditRedirectOutcome = "fulfilled";
              return response;
            } catch (error) {
              if (observe) (window as RedirectWindow).__redditRedirectOutcome = "rejected";
              throw error;
            }
          };
        });
        await page.goto(`${origin}/`);
        await page.waitForFunction(() => (window as RedirectWindow).__redditRedirectOutcome !== undefined);
        expect({status, escapedRequests}).toEqual({status, escapedRequests: 0});
        expect(initialRequests).toBe(1);
        expect(await page.evaluate(() => (window as RedirectWindow).__redditRedirectOutcome)).toBe("rejected");
      } finally {
        await context.close();
      }
    }
  } finally {
    destination.closeAllConnections();
    await new Promise<void>((resolve, reject) => destination.close(error => error ? reject(error) : resolve()));
  }
}
