import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {expectWebStandards} from "../../play/__tests__/webStandards.jest-playwright.support";
import {createEmptyYouTubeSave} from "../../playable/save";
import {
  installYouTubeSdkHarness,
  startYouTubeArtifactServer,
  youtubeHarnessSnapshot,
  type YouTubeArtifactServer,
} from "./youtubeBrowser.jest-playwright.support";
/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Describes the artifact fields needed by the browser harness. */
interface YouTubeArtifactManifest {
  /** Stores the exact content version embedded in the artifact under test. */
  contentVersion: string;
}
/** Provides expect ordered behavior. */
const expectOrdered = (events: readonly string[], expected: readonly string[]): void => {
  /** Provides cursor behavior. */
  let cursor = -1;
  for (const event of expected) {
    /** Provides next behavior. */
    const next = events.indexOf(event, cursor + 1);
    if (next < 0) throw new Error(`Missing ordered event ${event}: ${JSON.stringify(events)}`);
    expect(next).toBeGreaterThan(cursor);
    cursor = next;
  }
};
/** Provides wait for sdk event behavior. */
const waitForSdkEvent = (page: Page, event: string): Promise<unknown> =>
  page.waitForFunction((expected) => window.__youtubeHarness.events.includes(expected), event);

describeBrowser("YouTube Playables artifact with injected Game API", () => {
  /** Provides artifact behavior. */
  let artifact: YouTubeArtifactServer;
  /** Provides browser behavior. */
  let browser: Browser;
  /** Stores the exact content version served to the browser. */
  let artifactContentVersion: string;

  beforeAll(async () => {
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../..");
    /** Provides manifest behavior. */
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, "../../builds/youtube/youtube-content-manifest.json"), "utf8"),
    ) as YouTubeArtifactManifest;
    artifactContentVersion = manifest.contentVersion;
    artifact = await startYouTubeArtifactServer();
    browser = await chromium.launch({headless: true});
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await artifact?.close();
  });

  it("fails closed on load, retries in order, and exposes only the self-contained solo surface", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    /** Requests s. */
    const requests: Array<{
      /** Stores url. */
      url: string;
      /** Stores type. */
      type: string;
    }> = [];
    /** Provides errors behavior. */
    const errors: string[] = [];
    page.on("request", (request) => requests.push({url: request.url(), type: request.resourceType()}));
    page.on("pageerror", (error) => errors.push(error.message));
    await installYouTubeSdkHarness(page, {
      language: "fr-CA",
      audioEnabled: false,
      loadResults: [
        {kind: "reject", message: "cloud-save-temporarily-unavailable"},
        {kind: "resolve", value: ""},
      ],
    });

    await page.goto(artifact.origin);
    await page.getByRole("alert").waitFor();
    expect(await page.getByRole("button", {name: "Retry"}).isVisible()).toBe(true);
    /** Provides snapshot behavior. */
    let snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, [
      "sdk:first-frame-ready",
      "sdk:load:start:1",
      "sdk:load:failure:1",
      "sdk:health:error",
    ]);
    expect(snapshot.events).not.toContain("sdk:game-ready");
    expect(snapshot.events.some((event) => event.startsWith("sdk:save:"))).toBe(false);

    await page.getByRole("button", {name: "Retry"}).click();
    await page.getByRole("heading", {name: "Choisissez une énigme"}).waitFor();
    await waitForSdkEvent(page, "sdk:game-ready");
    snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, ["sdk:load:start:2", "sdk:load:success:2", "sdk:language:fr-CA", "sdk:game-ready"]);
    expect(snapshot.events.filter((event) => event === "sdk:first-frame-ready")).toHaveLength(1);
    expect(snapshot.events.filter((event) => event === "sdk:game-ready")).toHaveLength(1);
    expect(snapshot.savedPayloads).toEqual([]);
    expect(await page.locator("[data-youtube-playable-root]").getAttribute("lang")).toBe("fr");
    expect(await page.locator("html").getAttribute("data-youtube-audio")).toBe("disabled");

    for (const forbidden of [
      /buy coins/i,
      /shop/i,
      /sign in|log in/i,
      /share/i,
      /race to 10/i,
      /leaderboard/i,
      /edit profile/i,
      /delete account/i,
      /multiplayer/i,
      /quit|exit game/i,
    ]) {
      expect(await page.getByText(forbidden).count()).toBe(0);
    }
    expect(await page.getByRole("button", {name: /language|langue|mute|sound|audio/i}).count()).toBe(0);
    expect(await page.locator("a[href],form[action]").count()).toBe(0);
    expect(await page.locator('script[src="https://www.youtube.com/game_api/v1"]').count()).toBe(1);
    expect(
      await page
        .locator('script[src*="firebase"],script[src*="sentry"],script[src*="fbinstant"],script[src*="jest.com"]')
        .count(),
    ).toBe(0);
    /** Provides external requests behavior. */
    const externalRequests = requests.filter(({url}) => !url.startsWith(artifact.origin));
    expect(externalRequests).toEqual([{url: "https://www.youtube.com/game_api/v1", type: "script"}]);
    expect(errors).toEqual([]);
    await page.close();
  }, 45_000);

  it("defers locale, rendering, and game-ready work when pause arrives during startup", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await installYouTubeSdkHarness(page, {
      language: "es-419",
      audioEnabled: false,
      pauseOnSubscribe: true,
      loadResults: [{kind: "resolve", value: "", delayMs: 120}],
    });
    await page.goto(artifact.origin);
    await page.locator("html.youtube-game-paused").waitFor();
    await page.waitForTimeout(50);
    /** Provides snapshot behavior. */
    let snapshot = await youtubeHarnessSnapshot(page);
    expect(snapshot.events).not.toContain("sdk:first-frame-ready");
    expect(snapshot.events.some((event) => event.startsWith("sdk:load:start:"))).toBe(false);

    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await waitForSdkEvent(page, "sdk:load:start:1");
    await page.evaluate(() => window.__youtubeHarness.emitPause());
    await page.locator("html.youtube-game-paused").waitFor();
    await page.waitForTimeout(160);
    snapshot = await youtubeHarnessSnapshot(page);
    expect(snapshot.events).toContain("sdk:load:success:1");
    expect(snapshot.events.some((event) => event.startsWith("sdk:language:"))).toBe(false);
    expect(snapshot.events).not.toContain("sdk:game-ready");
    expect(await page.getByText("Loading your progress…").isVisible()).toBe(true);
    expect(await page.locator(".yt-loader").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe(
      "paused",
    );

    await page.evaluate(() => window.__youtubeHarness.emitAudio(true));
    expect(await page.locator("html").getAttribute("data-youtube-audio")).toBe("disabled");
    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await page.getByRole("heading", {name: "Elige un acertijo"}).waitFor();
    await waitForSdkEvent(page, "sdk:game-ready");
    snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, [
      "host:pause-on-subscribe",
      "host:resume",
      "sdk:first-frame-ready",
      "sdk:load:start:1",
      "host:pause",
      "sdk:load:success:1",
      "host:resume",
      "sdk:language:es-419",
      "sdk:game-ready",
    ]);
    expect(await page.locator("html").getAttribute("data-youtube-audio")).toBe("enabled");
    await page.close();
  }, 45_000);

  it("persists a schema migration before resolving locale and retries the exact bytes", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    /** Provides current behavior. */
    const current = createEmptyYouTubeSave("legacy-content");
    /** Provides {preferences:  preferences, ...without preferences} behavior. */
    const {preferences: _preferences, ...withoutPreferences} = current;
    /** Provides schema zero behavior. */
    const schemaZero = JSON.stringify({...withoutPreferences, schemaVersion: 0});
    await installYouTubeSdkHarness(page, {
      language: "fr-CA",
      loadResults: [{kind: "resolve", value: schemaZero}],
      saveResults: [{kind: "reject", message: "migration-save-uncertain"}, {kind: "resolve"}, {kind: "resolve"}],
    });

    await page.goto(artifact.origin);
    await page.getByRole("alert").waitFor();
    /** Provides snapshot behavior. */
    let snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, ["sdk:load:success:1", "sdk:save:start:1", "sdk:save:failure:1"]);
    expect(snapshot.events.some((event) => event.startsWith("sdk:language:"))).toBe(false);
    expect(snapshot.events).not.toContain("sdk:game-ready");
    expect(snapshot.savedPayloads).toHaveLength(1);
    expect(JSON.parse(snapshot.savedPayloads[0] ?? "{}")).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      contentVersion: "legacy-content",
    });

    await page.getByRole("button", {name: "Retry"}).click();
    await page.getByRole("heading", {name: "Choisissez une énigme"}).waitFor();
    await waitForSdkEvent(page, "sdk:game-ready");
    snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, [
      "sdk:save:start:2",
      "sdk:save:success:2",
      "sdk:language:fr-CA",
      "sdk:save:start:3",
      "sdk:save:success:3",
      "sdk:game-ready",
    ]);
    expect(snapshot.savedPayloads).toHaveLength(3);
    expect(snapshot.savedPayloads[1]).toBe(snapshot.savedPayloads[0]);
    expect(JSON.parse(snapshot.savedPayloads[2] ?? "{}")).toMatchObject({
      schemaVersion: 1,
      revision: 2,
      contentVersion: artifactContentVersion,
    });
    await page.close();
  }, 45_000);

  it("renders feedback and accepts the next draft during a slow platform save", async () => {
    /** Runs the real artifact with deliberately delayed persistence. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await installYouTubeSdkHarness(page, {
      saveResults: [{kind: "resolve"}, {kind: "resolve", delayMs: 5000}],
    });
    await page.goto(artifact.origin);
    await page.getByRole("button", {name: /Classic/}).click();
    await page.getByRole("heading", {name: /Which ancient city/}).waitFor();
    for (const letter of "XXXX") {
      await page.locator(".yt-keyboard button", {hasText: new RegExp(`^${letter}$`)}).click();
    }
    /** Measures rendering while the save promise is still unresolved. */
    const latency = await page.getByRole("button", {name: "Submit", exact: true}).evaluate(async (button) => {
      /** Starts before invoking the game handler. */
      const started = performance.now();
      (button as HTMLButtonElement).click();
      while (document.querySelectorAll(".yt-guess-row .yt-tile.red").length !== 4) {
        if (performance.now() - started > 1000) throw new Error("Feedback waited for platform save");
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return performance.now() - started;
    });
    expect(latency).toBeLessThan(250);
    await page.locator(".yt-keyboard button", {hasText: /^R$/}).click();
    expect(await page.locator(".yt-guess-row.current .yt-tile").first().textContent()).toBe("r");
    expect(await page.getByRole("button", {name: "Submit", exact: true}).isDisabled()).toBe(true);
    await waitForSdkEvent(page, "sdk:save:success:2");
    expect(await page.locator(".yt-guess-row.current .yt-tile").first().textContent()).toBe("r");
    console.info(`YouTube: feedback ${latency.toFixed(1)}ms during a five-second save`);
    await page.close();
  }, 30_000);

  it("persists each material action, retries the exact payload, and accepts mouse, touch, keyboard, and IME input", async () => {
    /** Provides context behavior. */
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
    /** Provides page behavior. */
    const page = await context.newPage();
    await installYouTubeSdkHarness(page, {
      saveResults: [{kind: "resolve"}, {kind: "reject", message: "injected-save-failure"}, {kind: "resolve"}],
    });
    await page.goto(artifact.origin);
    await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    await expectWebStandards(page, "youtube home");
    await page.getByRole("button", {name: /Classic/}).click();
    await page.getByRole("heading", {name: /Which ancient city/}).waitFor();
    await expectWebStandards(page, "youtube game");
    /** Provides input behavior. */
    const input = page.getByRole("textbox", {name: "Type your answer"});
    await input.press("r");
    await page.locator(".yt-keyboard button", {hasText: /^O$/u}).click();
    /** Provides m key behavior. */
    const mKey = page.locator(".yt-keyboard button", {hasText: /^M$/u});
    /** Provides box behavior. */
    const box = await mKey.boundingBox();
    if (!box) throw new Error("youtube-touch-key-unavailable");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    /** Provides compose behavior. */
    const compose = (value: string) =>
      input.evaluate((element, committed) => {
        /** Provides native input behavior. */
        const nativeInput = element as HTMLInputElement;
        nativeInput.focus({preventScroll: true});
        nativeInput.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true, data: committed}));
        nativeInput.value = committed;
        nativeInput.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: committed,
            inputType: "insertCompositionText",
            isComposing: true,
          }),
        );
        nativeInput.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true, data: committed}));
      }, value);
    await compose("日");
    await page.locator(".yt-guess-row.current").getByText("日", {exact: true}).waitFor();
    await input.press("Backspace");
    await page.waitForFunction(() => !document.querySelector(".yt-guess-row.current")?.textContent?.includes("日"));
    await compose("e");
    await page.locator(".yt-guess-row.current").getByText("e", {exact: true}).waitFor();
    await page.getByRole("button", {name: "Submit"}).click();
    await page.getByRole("alert").getByRole("button", {name: "Retry"}).waitFor();
    /** Provides snapshot behavior. */
    let snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, [
      "sdk:load:success:1",
      "sdk:save:start:1",
      "sdk:save:success:1",
      "sdk:save:start:2",
      "sdk:save:failure:2",
    ]);
    expect(snapshot.savedPayloads).toHaveLength(2);
    expect(JSON.parse(snapshot.savedPayloads[0])).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      activeGame: {mode: "classic", riddleId: "race:history:01"},
    });
    expect(JSON.parse(snapshot.savedPayloads[1])).toMatchObject({
      schemaVersion: 1,
      revision: 2,
      activeGame: null,
      progression: {classicIndex: 1, gamesPlayed: 1, totalWins: 1},
    });
    expect(await page.getByRole("button", {name: "Continue"}).isDisabled()).toBe(true);
    /** Provides achievement icons behavior. */
    const achievementIcons = page.locator(".yt-achievement-icons [role=img]");
    expect(await achievementIcons.count()).toBeGreaterThan(0);
    for (let index = 0; index < (await achievementIcons.count()); index += 1) {
      expect(await achievementIcons.nth(index).getAttribute("aria-label")).toBeTruthy();
      expect(await achievementIcons.nth(index).getAttribute("aria-hidden")).toBeNull();
    }

    await page.evaluate(() => window.__youtubeHarness.emitPause());
    await page.locator("html.youtube-game-paused").waitFor();
    await page.waitForFunction(() => window.__youtubeHarness.events.includes("sdk:save:success:3"));
    snapshot = await youtubeHarnessSnapshot(page);
    expect(snapshot.savedPayloads).toHaveLength(3);
    expect(snapshot.savedPayloads[2]).toBe(snapshot.savedPayloads[1]);
    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await page.locator("html:not(.youtube-game-paused)").waitFor();
    await page.waitForFunction(() => {
      /** Provides button behavior. */
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) => candidate.textContent?.trim() === "Continue",
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    snapshot = await youtubeHarnessSnapshot(page);
    expect(snapshot.savedPayloads).toHaveLength(3);
    expect(await page.getByRole("button", {name: "Continue"}).isEnabled()).toBe(true);
    await page.getByRole("button", {name: "Continue"}).click();
    await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    await page.getByRole("button", {name: "Progress"}).click();
    /** Provides reduced motion behavior. */
    const reducedMotion = page.getByRole("checkbox", {name: "Reduced motion"});
    /** Provides high contrast behavior. */
    const highContrast = page.getByRole("checkbox", {name: "High contrast"});
    await reducedMotion.check();
    await page.locator("html.youtube-reduced-motion").waitFor();
    await highContrast.check();
    await page.locator("html.youtube-high-contrast").waitFor();
    await context.close();
  }, 45_000);

  it("keeps the fixed QWERTY output ASCII under Turkish SDK locale casing", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await installYouTubeSdkHarness(page, {language: "tr-TR"});
    await page.goto(artifact.origin);
    await waitForSdkEvent(page, "sdk:game-ready");
    await page.locator(".yt-mode-card").first().click();
    /** Provides mobile puzzle proportions. */
    const mobilePuzzleWidths = await page.evaluate(() => ({
      gameArea: document.querySelector(".yt-puzzle")?.getBoundingClientRect().width ?? 0,
      keyboard: document.querySelector(".yt-keyboard")?.getBoundingClientRect().width ?? Infinity,
    }));
    expect(mobilePuzzleWidths.keyboard).toBeLessThan(mobilePuzzleWidths.gameArea);
    await page.locator(".yt-keyboard button").filter({hasText: /^I$/u}).click();
    /** Provides letters behavior. */
    const letters = await page.locator(".yt-guess-row.current .yt-tile").allTextContents();
    expect(letters[0]).toBe("i");
    await page.close();
  }, 45_000);

  it("confirms future-save reset, retries its exact write, and restores an active game on reload", async () => {
    /** Resets page. */
    const resetPage = await browser.newPage({viewport: {width: 390, height: 844}});
    await installYouTubeSdkHarness(resetPage, {
      loadResults: [{kind: "resolve", value: JSON.stringify({schemaVersion: 2, future: true})}],
      saveResults: [{kind: "reject", message: "reset-save-uncertain"}, {kind: "resolve"}, {kind: "resolve"}],
    });
    await resetPage.goto(artifact.origin);
    await resetPage.getByText("This progress was created by a newer game version.").waitFor();
    expect((await youtubeHarnessSnapshot(resetPage)).savedPayloads).toEqual([]);
    await resetPage.getByRole("button", {name: "Start fresh"}).click();
    await resetPage.getByRole("heading", {name: "Reset local progress?"}).waitFor();
    expect((await youtubeHarnessSnapshot(resetPage)).savedPayloads).toEqual([]);
    await resetPage.getByRole("button", {name: "Start fresh"}).click();
    await resetPage.getByRole("alert").waitFor();
    await resetPage.getByRole("button", {name: "Retry"}).waitFor();
    /** Resets snapshot. */
    let resetSnapshot = await youtubeHarnessSnapshot(resetPage);
    expect(resetSnapshot.savedPayloads).toHaveLength(1);
    await resetPage.getByRole("button", {name: "Retry"}).click();
    await resetPage.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    resetSnapshot = await youtubeHarnessSnapshot(resetPage);
    expect(resetSnapshot.savedPayloads).toHaveLength(2);
    expect(resetSnapshot.savedPayloads[1]).toBe(resetSnapshot.savedPayloads[0]);

    await resetPage.getByRole("button", {name: /Classic/}).click();
    await resetPage.getByRole("heading", {name: /Which ancient city/}).waitFor();
    resetSnapshot = await youtubeHarnessSnapshot(resetPage);
    /** Provides active payload behavior. */
    const activePayload = resetSnapshot.savedPayloads.at(-1);
    if (!activePayload) throw new Error("youtube-active-save-fixture-missing");
    expect(JSON.parse(activePayload)).toMatchObject({activeGame: {mode: "classic", riddleId: "race:history:01"}});
    await resetPage.close();
    /** Provides restored page behavior. */
    const restoredPage = await browser.newPage({viewport: {width: 390, height: 844}});
    await installYouTubeSdkHarness(restoredPage, {
      loadResults: [{kind: "resolve", value: activePayload}],
    });
    await restoredPage.goto(artifact.origin);
    await restoredPage.getByRole("heading", {name: /Which ancient city/}).waitFor();
    await waitForSdkEvent(restoredPage, "sdk:game-ready");
    /** Provides restored snapshot behavior. */
    const restoredSnapshot = await youtubeHarnessSnapshot(restoredPage);
    expectOrdered(restoredSnapshot.events, [
      "sdk:first-frame-ready",
      "sdk:load:start:1",
      "sdk:load:success:1",
      "sdk:language:en",
      "sdk:game-ready",
    ]);
    expect(restoredSnapshot.savedPayloads).toEqual([]);
    expect(await restoredPage.locator(".yt-guess-row.current .yt-tile").count()).toBe(4);
    await restoredPage.close();
  }, 45_000);

  it("uses SDK lifecycle/audio instead of browser signals and never consumes Escape", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 800, height: 600}});
    await installYouTubeSdkHarness(page, {audioEnabled: false});
    await page.goto(artifact.origin);
    await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    /** Provides guidance behavior. */
    const guidance = page.locator(".yt-banner", {hasText: "Choose a puzzle"});
    await guidance.waitFor();
    await page.evaluate(() => window.__youtubeHarness.emitPause());
    await page.locator("html.youtube-game-paused").waitFor();
    expect(await guidance.getByRole("button", {name: "Dismiss"}).isDisabled()).toBe(true);
    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await page.locator("html:not(.youtube-game-paused)").waitFor();
    await guidance.getByRole("button", {name: "Dismiss"}).click();
    await guidance.waitFor({state: "detached"});
    await page.getByRole("button", {name: /Classic/}).click();
    /** Provides input behavior. */
    const input = page.getByRole("textbox", {name: "Type your answer"});
    await input.press("r");
    /** Saves s before pause. */
    const savesBeforePause = (await youtubeHarnessSnapshot(page)).savedPayloads.length;

    await page.evaluate(() => window.__youtubeHarness.emitPause());
    await page.locator("html.youtube-game-paused").waitFor();
    expect(await page.locator("[data-youtube-playable-root]").getAttribute("inert")).toBe("");
    await page.waitForFunction(
      () => (document.querySelector('[aria-label="Type your answer"]') as HTMLInputElement)?.disabled,
    );
    expect(await input.isDisabled()).toBe(true);
    await page.waitForTimeout(50);
    /** Provides paused snapshot behavior. */
    const pausedSnapshot = await youtubeHarnessSnapshot(page);
    expect(pausedSnapshot.savedPayloads).toHaveLength(savesBeforePause);
    expect(pausedSnapshot.savedPayloads.at(-1)).not.toContain("currentLetters");
    expect(pausedSnapshot.savedPayloads.at(-1)).not.toContain('"answer"');
    /** Provides events before browser signals behavior. */
    const eventsBeforeBrowserSignals = (await youtubeHarnessSnapshot(page)).events;
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    await page.waitForTimeout(50);
    expect(await page.locator("html").getAttribute("class")).toContain("youtube-game-paused");
    expect((await youtubeHarnessSnapshot(page)).events).toEqual(eventsBeforeBrowserSignals);

    await page.evaluate(() => window.__youtubeHarness.emitAudio(true));
    expect(await page.locator("html").getAttribute("data-youtube-audio")).toBe("disabled");
    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await page.locator("html:not(.youtube-game-paused)").waitFor();
    expect(await page.locator("html").getAttribute("data-youtube-audio")).toBe("enabled");
    expect(await page.locator("[data-youtube-playable-root]").getAttribute("inert")).toBeNull();
    expect(await input.isEnabled()).toBe(true);
    /** Provides escape prevented behavior. */
    const escapePrevented = await input.evaluate((element) => {
      /** Provides event behavior. */
      const event = new KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true});
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(escapePrevented).toBe(false);
    /** Provides snapshot behavior. */
    const snapshot = await youtubeHarnessSnapshot(page);
    expectOrdered(snapshot.events, ["host:pause", "host:audio:true", "host:resume"]);
    expect(snapshot.activePauseSubscribers).toBe(1);
    expect(snapshot.activeResumeSubscribers).toBe(1);
    expect(snapshot.activeAudioSubscribers).toBe(1);
    await page.close();
  }, 45_000);

  it("refreshes the Daily day at UTC midnight but defers rollover while platform-paused", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await page.clock.install({time: new Date("2026-08-20T23:59:59.500Z")});
    await installYouTubeSdkHarness(page);
    await page.goto(artifact.origin);
    await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    /** Provides daily behavior. */
    const daily = page.getByRole("button", {name: /Daily/});
    await daily.getByText("2026-08-20").waitFor();

    await page.evaluate(() => window.__youtubeHarness.emitPause());
    await page.locator("[data-youtube-playable-root][inert]").waitFor();
    await page.clock.fastForward(2_000);
    expect(await daily.textContent()).toContain("2026-08-20");

    await page.evaluate(() => window.__youtubeHarness.emitResume());
    await daily.getByText("2026-08-21").waitFor();
    await page.close();
  }, 45_000);

  it("starts at 0x0 and preserves an active puzzle across certification viewport changes", async () => {
    /** Provides page behavior. */
    const page = await browser.newPage({viewport: {width: 1400, height: 1400}});
    await installYouTubeSdkHarness(page);
    await page.goto(`${artifact.origin}/__zero-size-host.html`);
    /** Provides frame behavior. */
    const frame = page.frames().find((candidate) => candidate.url() === `${artifact.origin}/`);
    if (!frame) throw new Error("youtube-zero-size-frame-unavailable");
    await frame.waitForFunction(() => window.__youtubeHarness.events.includes("sdk:game-ready"));
    expect(
      await page.locator("#playable").evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
    ).toEqual({width: 0, height: 0});
    /** Provides dimensions behavior. */
    const dimensions = [
      [360, 1280],
      [360, 840],
      [360, 640],
      [600, 800],
      [720, 720],
      [800, 600],
      [960, 540],
      [1260, 540],
      [1280, 360],
    ] as const;
    await page.locator("#playable").evaluate((element, [width, height]) => {
      /** Provides iframe behavior. */
      const iframe = element as HTMLIFrameElement;
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
    }, dimensions[0]);
    await frame.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    await frame.getByRole("button", {name: /Classic/}).click();
    await frame.getByRole("textbox", {name: "Type your answer"}).press("r");

    for (const dimension of dimensions) {
      await page.locator("#playable").evaluate((element, [width, height]) => {
        /** Provides iframe behavior. */
        const iframe = element as HTMLIFrameElement;
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
      }, dimension);
      await frame.waitForFunction(() => document.documentElement.clientWidth > 0);
      /** Provides layout behavior. */
      const layout = await frame.evaluate(() => ({
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        activeLetters: Array.from(document.querySelectorAll(".yt-guess-row.current .yt-tile"))
          .map((tile) => tile.textContent ?? "")
          .join(""),
      }));
      expect(layout.width).toBe(dimension[0]);
      expect(layout.height).toBe(dimension[1]);
      expect(layout.scrollWidth).toBeLessThanOrEqual(dimension[0] + 1);
      expect(layout.activeLetters).toContain("r");
    }
    await page.close();
  }, 45_000);
});
