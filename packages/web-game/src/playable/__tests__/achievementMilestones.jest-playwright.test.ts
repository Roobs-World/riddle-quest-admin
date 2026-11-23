import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {createEmptyYouTubeSave} from "../save";
import {installYouTubeSdkHarness, startYouTubeArtifactServer, youtubeHarnessSnapshot} from "../../../../../platforms/web/youtube/src/__tests__/youtubeBrowser.jest-playwright.support";

/** Exercises actual artifacts only when browser checks are requested. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("earned achievement milestones in isolated solo artifacts", () => {
  it.each(["youtube", "netflix", "yahoo"] as const)("%s earns, saves and reloads the new win/play badges", async target => {
    /** Portal workspace containing the built isolated artifacts. */
    const packageRoot = path.resolve(__dirname, "../../..");
    /** Local HTTP server exposing this target artifact. */
    const artifact = await startYouTubeArtifactServer(target);
    /** Content identity embedded in the exact artifact under test. */
    const manifest = JSON.parse(await readFile(path.join(artifact.directory, "youtube-content-manifest.json"), "utf8"));
    /** Browser executing the built gameplay and persistence paths. */
    const browser = await chromium.launch({headless: true});
    /** Directory retaining screenshots of earned milestone badges. */
    const evidence = path.resolve(packageRoot, "../../builds/test-evidence/achievements-expansion/browser");
    await mkdir(evidence, {recursive: true});
    try {
      for (const width of [390, 1280]) {
        /** Fresh target storage and viewport for each gameplay check. */
        const context = await browser.newContext({locale: "en-GB", viewport: {width, height: 844}});
        /** Artifact page with the target persistence harness injected. */
        const page = await context.newPage();
        /** Uncaught runtime errors observed during the milestone flow. */
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        /** Initial progress one successful game below both ten-game milestones. */
        const save = createEmptyYouTubeSave(manifest.contentVersion);
        Object.assign(save.progression, {totalWins: 9, gamesPlayed: 9, totalGuesses: 18, totalGuessesInWins: 18});
        save.preferences.guidanceComplete = true;
        save.progression.unlockedAchievementIds = ["first_win", "wins_5", "perfect_guess", "classic_perfect", "win_rate_80", "efficient_10"];
        if (target === "youtube") {
          await installYouTubeSdkHarness(page, {loadResults: [{kind: "resolve", value: JSON.stringify(save)}]});
        } else {
          await page.addInitScript(({key, value}) => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, value);
          }, {key: `riddle-quest:${target}:save-v1`, value: JSON.stringify(save)});
        }
        await page.goto(artifact.origin);
        await page.getByRole("button", {name: /Classic/}).click();
        await page.getByRole("heading", {name: /Which ancient city/}).waitFor();
        for (const letter of "ROME") await page.locator(".yt-keyboard button", {hasText: new RegExp(`^${letter}$`)}).click();
        await page.getByRole("button", {name: "Submit", exact: true}).click();
        await page.getByRole("heading", {name: "Solved!"}).waitFor();
        /** New unlocks displayed by the actual completion screen. */
        const badges = page.locator('[aria-label="New achievements"]');
        expect(await badges.getByRole("img", {name: "Wins: 10", exact: true}).count()).toBe(1);
        expect(await badges.getByRole("img", {name: "Games: 10", exact: true}).count()).toBe(1);
        await page.screenshot({path: path.join(evidence, `${target}-earned-${width}.png`), fullPage: true});
        /** Target-owned committed save containing the milestone grants. */
        const persisted = target === "youtube" ? (await youtubeHarnessSnapshot(page)).savedPayloads.at(-1)!
          : await page.evaluate(key => localStorage.getItem(key)!, `riddle-quest:${target}:save-v1`);
        expect(JSON.parse(persisted).progression).toMatchObject({coins: 355, totalWins: 10, gamesPlayed: 10,
          unlockedAchievementIds: expect.arrayContaining(["wins_10", "games_10"])});
        /** Page restoring the committed target-owned progress. */
        const reloaded = target === "youtube" ? await context.newPage() : page;
        if (target === "youtube") await installYouTubeSdkHarness(reloaded, {loadResults: [{kind: "resolve", value: persisted}]});
        await reloaded.goto(artifact.origin);
        await reloaded.getByRole("button", {name: "Progress", exact: true}).click();
        /** Restored achievement collection on the Progress screen. */
        const achievements = reloaded.locator('[aria-label="Achievements"]');
        expect(await achievements.getByRole("img", {name: "Wins: 10", exact: true}).count()).toBe(1);
        expect(await achievements.getByRole("img", {name: "Games: 10", exact: true}).count()).toBe(1);
        expect(errors).toEqual([]);
        console.info(`${target}: earned both badges and restored them at ${width}px`);
        await context.close();
      }
    } finally {
      await browser.close();
      await artifact.close();
    }
  }, 60_000);
});
