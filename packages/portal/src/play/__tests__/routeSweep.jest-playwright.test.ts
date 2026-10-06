import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";

/** Runs only in explicit browser test runs. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Optional override for the longest chain of player choices followed from the game screen. */
const DEPTH_OVERRIDE = process.env.PORTAL_ROUTE_SWEEP_DEPTH ? Number(process.env.PORTAL_ROUTE_SWEEP_DEPTH) : undefined;
/** Upper bound on distinct routes per entry point, so a UI explosion fails loudly instead of hanging. */
const MAX_ROUTES = Number(process.env.PORTAL_ROUTE_SWEEP_MAX_ROUTES ?? "400");
jest.setTimeout(45 * 60_000);

/** Answer entry is gameplay, not navigation; the gameplay suites type and submit answers. */
const ANSWER_ENTRY = /^(letter \d+(:.*)?|[a-z]|backspace|submit)$/i;

/** One way a player can arrive in the game. */
type Entry = {
  /** Human-readable entry name used in failure reports. */
  name: string;
  /** Query string selecting the deterministic harness scenario. */
  query: string;
  /** Longest chain of choices followed; multiplayer needs more steps to reach a match. */
  depth: number;
};

/** Entry points covering Daily, Classic and multiplayer starts. */
const ENTRIES: Entry[] = [
  {name: "Daily start", query: "?harness=jest", depth: 3},
  {name: "Classic start", query: "?harness=jest&dailyCompleted=1", depth: 3},
  {name: "Multiplayer-enabled start", query: "?harness=race&dailyCompleted=1", depth: 5},
];

/** A choice the player can make in the current state, identified stably across fresh loads. */
type Choice = {
  /** Accessible label or visible text. */
  label: string;
  /** Position among same-labelled choices in the current state. */
  occurrence: number;
};

/** Snapshot of what the player can see and do. */
type ScreenState = {
  /** Labels of open dialogs, outermost first. */
  dialogs: string[];
  /** Choices available in the topmost interactive layer. */
  choices: Choice[];
  /** External links in the current layer, which must carry a usable destination. */
  links: Array<{
    /** Link text. */
    label: string;
    /** Destination. */
    href: string;
  }>;
  /** Whether the fatal error boundary or a surface recovery dialog is showing. */
  failed: boolean;
};

/** Formats a route for failure messages. */
const describeRoute = (route: Choice[]) => route.map(({label, occurrence}) => occurrence ? `${label}#${occurrence}` : label).join(" → ") || "(game screen)";

/** Reads the topmost interactive layer and labels every choice in it. */
async function readScreen(page: Page): Promise<ScreenState> {
  return page.evaluate(() => {
    /** Whether an element is rendered, visible and not behind an inert or hidden ancestor. */
    const usable = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest("[inert], [aria-hidden='true']")) return false;
      if (element.matches(":disabled, [aria-disabled='true']")) return false;
      /** Rendered box. */
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
    };
    /** Open modal layers in document order. */
    const layers = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].filter(usable);
    /** Layer the player can act in; modals make everything beneath them inert. */
    const scope = layers.at(-1) ?? document.body;
    /** Accessible label of a control. */
    const labelOf = (element: Element) =>
      (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    /** Counts labels already seen so duplicates keep their order. */
    const seen = new Map<string, number>();
    /** Choices in the active layer. */
    const choices = [...scope.querySelectorAll("button, [role=button], [role=tab], [role=menuitem], input[type=checkbox], select")]
      .filter(usable)
      .map((element) => {
        /** Label for this control. */
        const label = labelOf(element);
        /** Position among same-labelled controls. */
        const occurrence = seen.get(label) ?? 0;
        seen.set(label, occurrence + 1);
        return {label, occurrence};
      });
    return {
      dialogs: layers.map(labelOf).map((label) => label.slice(0, 40)),
      choices,
      links: [...scope.querySelectorAll("a[href]")].filter(usable)
        .map((element) => ({label: labelOf(element), href: element.getAttribute("href") ?? ""})),
      failed: Boolean(document.querySelector(".route-missing, .surface-recovery")),
    };
  });
}

/** Dismisses guidance cards, which are informational and not part of a route. */
async function dismissGuidance(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    /** Visible guidance acknowledgement. */
    const gotIt = page.locator(".tooltip-card button, .onboarding-card .play-primary").first();
    if (!(await gotIt.isVisible().catch(() => false))) return;
    await gotIt.click({timeout: 2_000}).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

/** Clicks one choice in the active layer by its stable identity. */
async function choose(page: Page, choice: Choice): Promise<void> {
  /** Marks the control so Playwright can address it without re-deriving accessible names. */
  const mark = () => page.evaluate(({label, occurrence}) => {
    document.querySelectorAll("[data-route-sweep-target]").forEach((element) => element.removeAttribute("data-route-sweep-target"));
    /** Same usability rule as readScreen. */
    const usable = (element: Element) => element instanceof HTMLElement && !element.closest("[inert], [aria-hidden='true']") &&
      !element.matches(":disabled, [aria-disabled='true']") && element.getBoundingClientRect().width > 0;
    /** Active layer. */
    const scope = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].filter(usable).at(-1) ?? document.body;
    /** Matching controls in order. */
    const matches = [...scope.querySelectorAll("button, [role=button], [role=tab], [role=menuitem], input[type=checkbox], select")]
      .filter(usable)
      .filter((element) => (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) === label);
    /** Target control. */
    const target = matches[occurrence];
    if (!target) return false;
    target.setAttribute("data-route-sweep-target", "");
    return true;
  }, choice);
  // Controls such as Skip enable once background work settles; allow the same settling a player sees.
  /** Whether the choice was found within the settling window. */
  let found = await mark();
  for (let attempt = 0; !found && attempt < 40; attempt += 1) {
    await page.waitForTimeout(150);
    await dismissGuidance(page);
    found = await mark();
  }
  if (!found) throw new Error(`Choice "${choice.label}" is no longer offered`);
  /** Marked control. */
  const target = page.locator("[data-route-sweep-target]");
  if (await target.evaluate((element) => element.tagName === "SELECT")) {
    /** Second option, or the first when only one exists. */
    const value = await target.evaluate((element) => {
      /** Options of the select. */
      const options = [...(element as HTMLSelectElement).options];
      return (options[1] ?? options[0])?.value ?? "";
    });
    await target.selectOption(value);
  } else {
    await target.click({timeout: 5_000});
  }
  await page.waitForTimeout(350);
  await dismissGuidance(page);
}

describeBrowser("every player route", () => {
  /** Static server for the built Jest artifact. */
  let server: Server;
  /** Shared browser; each route gets its own isolated context. */
  let browser: Browser;
  /** Origin of the static server. */
  let origin: string;

  beforeAll(async () => {
    /** Built Jest artifact. */
    const dist = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../../../builds/jest");
    /** Content types the artifact needs. */
    const types: Record<string, string> = {
      ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
      ".svg": "image/svg+xml", ".webp": "image/webp", ".webm": "audio/webm", ".woff2": "font/woff2", ".ttf": "font/ttf",
    };
    server = createServer(async (request, response) => {
      /** Requested path. */
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      /** File on disk, falling back to the app shell for client routes. */
      const file = path.join(dist, pathname === "/" || !path.extname(pathname) ? "index.html" : pathname);
      try {
        /** File bytes. */
        const body = await readFile(file);
        response.writeHead(200, {"Content-Type": types[path.extname(file)] ?? "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** Bound address. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true});
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
  });

  it.each(ENTRIES)("reaches every choice from the $name without errors or dead ends", async ({query, depth}) => {
    /** Longest route followed for this entry. */
    const maxDepth = DEPTH_OVERRIDE ?? depth;
    /** Routes still to explore, breadth first. */
    const queue: Choice[][] = [[]];
    /** Screens already expanded, so equivalent states are explored once. */
    const expanded = new Set<string>();
    /** Every problem found, reported together. */
    const problems: string[] = [];
    /** Routes actually visited. */
    let visited = 0;

    while (queue.length > 0 && visited < MAX_ROUTES) {
      /** Route under test. */
      const route = queue.shift()!;
      visited += 1;
      /** Isolated storage so every route starts as a fresh player. */
      const context = await browser.newContext({viewport: {width: 390, height: 844}});
      await context.route("https://cdn.jest.com/**", (request) =>
        request.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** Page for this route. */
      const page = await context.newPage();
      /** Uncaught errors and console errors raised while following the route. */
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`uncaught: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      page.on("dialog", (dialog) => void dialog.dismiss());
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
      });
      try {
        await page.goto(`${origin}/${query}`);
        await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 20_000});
        await completeMockOnboarding(page);
        /** Optional guest choice shown by some starts. */
        const guest = page.getByRole("button", {name: /play as guest/i});
        if (await guest.isVisible().catch(() => false)) await guest.click();
        await dismissGuidance(page);
        await page.getByTestId("server-activity-loader").waitFor({state: "hidden"}).catch(() => undefined);
        await page.waitForTimeout(600);
        for (const choice of route) await choose(page, choice);
        /** What the player now sees, once transitional work (such as a language load) has settled. */
        let screen = await readScreen(page);
        for (let attempt = 0; screen.choices.length === 0 && !screen.failed && attempt < 40; attempt += 1) {
          await page.waitForTimeout(150);
          screen = await readScreen(page);
        }
        if (screen.failed) problems.push(`${describeRoute(route)}: shows the error or recovery screen`);
        if (screen.choices.length === 0) problems.push(`${describeRoute(route)}: dead end with no available choice`);
        for (const link of screen.links) {
          if (!/^(https:|mailto:|\.?\/|#)/.test(link.href)) problems.push(`${describeRoute(route)}: link "${link.label}" has unusable href ${link.href}`);
        }
        if (errors.length) problems.push(`${describeRoute(route)}: ${errors.join(" | ")}`);
        /** Equivalent screens are expanded once. */
        const signature = JSON.stringify([screen.dialogs, screen.choices.map(({label}) => label)]);
        if (route.length < maxDepth && !expanded.has(signature)) {
          expanded.add(signature);
          for (const choice of screen.choices) {
            if (!ANSWER_ENTRY.test(choice.label)) queue.push([...route, choice]);
          }
        }
      } catch (error) {
        problems.push(`${describeRoute(route)}: ${(error as Error).message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
    console.log(`Route sweep ${query}: ${visited} routes, ${expanded.size} distinct screens, ${queue.length} unvisited`);
    expect(queue.length === 0 || visited < MAX_ROUTES ? [] : [`More than ${MAX_ROUTES} routes; raise PORTAL_ROUTE_SWEEP_MAX_ROUTES`]).toEqual([]);
    expect(problems).toEqual([]);
  });
});
