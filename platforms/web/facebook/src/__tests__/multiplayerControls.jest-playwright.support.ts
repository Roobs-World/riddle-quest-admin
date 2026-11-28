import {LiveRaceViewSchema, RACE_RULES} from "../../../../../src/races/contracts/index";
import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";

/** Advertised retired APIs must remain unused even when the server retains its tournament flag. */
export async function installRemovedTournamentFixtures(page: Page): Promise<void> {
  for (const endpoint of ["listFacebookTournament", "recordFacebookTournament"]) {
    await page.route(`**/${endpoint}`, async route => {
      await page.evaluate(name => Reflect.get(window, "__removedTournamentCalls").push(name), endpoint);
      await route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({error: "retired-tournament-endpoint"})});
    });
  }
  await page.addInitScript(() => {
    const sdk = window.FBInstant!;
    const supported = sdk.getSupportedAPIs.bind(sdk);
    Reflect.set(window, "__removedTournamentCalls", []);
    const record = (name: string) => {Reflect.get(window, "__removedTournamentCalls").push(name);};
    sdk.getSupportedAPIs = () => [...supported(), "getTournamentAsync", "tournament.getTournamentsAsync", "tournament.joinAsync",
      "tournament.createAsync", "tournament.createPrivateAsync", "tournament.shareAsync", "tournament.postScoreAsync",
      "postSessionScoreAsync", "postSessionScore"];
    sdk.getTournamentAsync = async () => {record("getTournamentAsync"); throw {code: "TOURNAMENT_NOT_FOUND"};};
    sdk.tournament = {
      getTournamentsAsync: async () => {record("getTournamentsAsync"); return [];},
      joinAsync: async () => {record("joinAsync");},
      createAsync: async () => {record("createAsync"); throw new Error("Retired tournament creation");},
      createPrivateAsync: async () => {record("createPrivateAsync"); throw new Error("Retired private tournament creation");},
      shareAsync: async () => {record("shareAsync");},
      postScoreAsync: async () => {record("postScoreAsync");},
    };
    sdk.postSessionScoreAsync = async () => {record("postSessionScoreAsync");};
    sdk.postSessionScore = () => {record("postSessionScore");};
    const incoming = new URL(location.href).searchParams.get("native-tournament");
    if (incoming) sdk.getEntryPointData = () => {
      const startsAtMs = Math.floor(Date.now() / 86400000) * 86400000;
      return {kind: "rq-race10-tournament-v1", locale: incoming,
        tournamentId: `facebook-race10-${incoming}-${new Date(startsAtMs).toISOString().slice(0, 10)}`,
        startsAtMs, endsAtMs: startsAtMs + 86400000};
    };
  });
}

async function expectRemovedControls(page: Page): Promise<void> {
  expect(await page.locator(".facebook-native-social, .race-tournaments").count()).toBe(0);
  expect(await page.getByRole("tab", {name: "Tournois", exact: true}).count()).toBe(0);
  for (const label of ["Jouer sur Facebook", "Choisir des amis", "Tournois Facebook", "Rejoindre le tournoi", "Partager le tournoi", "Partager le score de la course"])
    expect(await page.getByText(label, {exact: true}).count()).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, "__contextCreateCalls"))).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, "__removedTournamentCalls"))).toEqual([]);
}

/** Ordinary social buttons own both native context selection and optional room/solo controls. */
export async function verifyIntegratedMultiplayerControls(page: Page, nativeMatching: boolean): Promise<void> {
  await expectRemovedControls(page);
  await page.getByRole("tab", {name: "Activité", exact: true}).click();
  const choose = page.getByRole("button", {name: "Jouer avec des amis", exact: true});
  const leave = page.getByRole("button", {name: "Revenir au jeu en solo", exact: true});
  const join = page.getByRole("button", {name: "Rejoindre la partie du salon", exact: true});
  await leave.and(page.locator(":enabled")).waitFor();
  await join.and(page.locator(":enabled")).waitFor();
  const actions = choose.locator("..");
  expect(await actions.getAttribute("class")).toBe("race-hub-social-actions");
  expect(await actions.getByRole("button", {name: "Revenir au jeu en solo", exact: true}).count()).toBe(1);
  expect(await actions.getByRole("button", {name: "Rejoindre la partie du salon", exact: true}).count()).toBe(1);
  const match = page.getByRole("button", {name: "Trouver un adversaire", exact: true});
  expect(await match.count()).toBe(nativeMatching ? 1 : 0);
  if (nativeMatching) {
    await match.click();
    await page.waitForFunction(() => Reflect.get(window, "__matchPlayerRequest")?.tag === "race10_v1_fr");
  }
  // A cancelled solo switch leaves the chosen context intact and makes both actions usable again.
  await leave.evaluate((button: HTMLElement) => {button.click(); button.click();});
  await page.waitForFunction(() => Reflect.get(window, "__contextSwitchCalls").length === 1);
  expect(await leave.isDisabled()).toBe(true);
  await page.getByRole("tab").first().click();
  await page.getByRole("tab", {name: "Activité", exact: true}).click();
  await page.evaluate(() => Reflect.get(window, "__finishContextSwitch")(false));
  await leave.and(page.locator(":enabled")).waitFor();
  expect(await page.evaluate(() => Reflect.get(window, "__contextId"))).toBe("context-old");
  expect(await page.getByRole("alert").count()).toBe(0);
  // Opening a room uses the discovered context and then retires that already-current room action.
  await join.click();
  await page.waitForFunction(() => Reflect.get(window, "__contextSwitchCalls").length === 2);
  expect(await page.evaluate(() => Reflect.get(window, "__contextSwitchCalls"))).toEqual(["SOLO", "context-room"]);
  await page.evaluate(() => Reflect.get(window, "__finishContextSwitch")(true));
  await join.waitFor({state: "detached"});
  await page.waitForFunction(() => Reflect.get(window, "__contextMembershipRequest")?.contextId === "context-room");
  await leave.and(page.locator(":enabled")).waitFor();
  await leave.click();
  await page.waitForFunction(() => Reflect.get(window, "__contextSwitchCalls").length === 3);
  await page.evaluate(() => Reflect.get(window, "__finishContextSwitch")(true));
  await leave.waitFor({state: "detached"});
  await page.waitForFunction(() => Reflect.get(window, "__contextLeaveRequest")?.contextId === "context-room");
  expect(await page.evaluate(() => Reflect.get(window, "__contextId"))).toBeNull();
  expect(await page.getByRole("alert").count()).toBe(0);
  await expectRemovedControls(page);
  // Restore the fixture's original context for the existing chooser/cache regression sequence.
  await page.evaluate(() => Reflect.get(window, "__emitContextChange")("context-old"));
  await page.waitForFunction(() => Reflect.get(window, "__contextMembershipRequest")?.contextId === "context-old");
}

/** Historical tournament invitations and a retained backend flag cannot resurrect removed controls. */
export async function verifyRemovedTournamentEntry(page: Page, origin: string): Promise<void> {
  for (const flag of ["on", "off"]) {
    await page.goto(`${origin}/?harness=race&live-consent=on&native-tournament=en&tournaments=${flag}`);
    await page.locator(".game-bottom-navigation").waitFor();
    const onboarding = page.locator(".onboarding-card .play-primary");
    if (await onboarding.count()) {
      await onboarding.click();
      await page.locator(".onboarding-clues").waitFor();
      await onboarding.click();
      await onboarding.waitFor({state: "detached"});
    }
    for (let step = 0; step < 4; step++) {
      const tip = page.locator(".tooltip-backdrop");
      if (await tip.count()) await tip.locator("button").click();
    }
    expect(await page.locator(".race-challenge-card, .race-tournaments").count()).toBe(0);
    await page.locator(".multiplayer-navigation-action").click();
    await page.getByRole("tab", {name: "Activité", exact: true}).waitFor();
    await expectRemovedControls(page);
    expect(await page.getByRole("tab").allTextContents()).toEqual(["Jouer", "Activité"]);
    await page.getByRole("tab").first().focus();
    await page.getByRole("tab").first().press("End");
    expect(await page.getByRole("tab", {name: "Activité", exact: true}).getAttribute("aria-selected")).toBe("true");
    await page.getByRole("tab", {name: "Activité", exact: true}).press("Home");
    expect(await page.getByRole("tab").first().getAttribute("aria-selected")).toBe("true");
    expect(await page.getByRole("button", {name: "Revenir au jeu en solo", exact: true}).count()).toBe(0);
    expect(await page.getByRole("button", {name: "Rejoindre la partie du salon", exact: true}).count()).toBe(0);
    await page.locator(".race-close").click();
  }
}

/** Eligible live wins still record context standings without tournament or session-score calls. */
export async function verifyLiveContextResult(page: Page): Promise<void> {
  /** Provides records behavior. */
  const records: unknown[] = [];
  /** Context scoring remains independent of the optional tournament flag. */
  const contextRecords: unknown[] = [];
  await page.route("**/recordFacebookContextRun", async route => {
    /** The actual adapter supplies the selected SDK context and opaque ticket only. */
    const input = route.request().postDataJSON().data;
    contextRecords.push(input);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {
      locale: input.locale, runId: input.runId, adjustedTimeMs: 2500, completedAtMs: Date.now(),
      improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
    }})});
  });
  /** Provides solves behavior. */
  let solves = 9;
  /** Provides outcome behavior. */
  let outcome: "win" | "loss" | "tie" = "loss";
  await page.route("**/recordFacebookTournament", async route => {
    /** Provides input behavior. */
    const input = route.request().postDataJSON().data;
    records.push(input);
    /** Provides completed at ms behavior. */
    const completedAtMs = Date.now(), day = new Date(completedAtMs).toISOString().slice(0, 10);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {
      tournamentId: `facebook-race10-${input.locale}-${day}`, locale: input.locale, runId: input.runId,
      adjustedTimeMs: 2500, completedAtMs, improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
    }})});
  });
  await page.route("**/joinLiveRace", async route => {
    /** Provides {locale, category id} behavior. */
    const {locale, categoryId} = route.request().postDataJSON().data;
    /** Provides server now ms behavior. */
    const serverNowMs = Date.now(), startsAtMs = serverNowMs - 2500;
    /** Provides result behavior. */
    const result = LiveRaceViewSchema.parse({ticketId: "d".repeat(64), phase: "result",
      serverNowMs, startsAtMs, searchEndsAtMs: serverNowMs + 60000,
      player: {displayName: "FacebookSolver", avatarUrl: null, bot: false, correctCount: solves},
      opponent: {displayName: "LiveRival", avatarUrl: null, bot: false, correctCount: 0},
      run: {runId: "d".repeat(64), role: "creator", status: "completed", categoryId, locale, rules: RACE_RULES,
        correctCount: solves, wallElapsedMs: 2500, totalPenaltyMs: 0, adjustedElapsedMs: 2500, currentRiddle: null, events: []},
      result: outcome, rewardCoins: 0,
    });
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: result})});
  });
  await page.locator(".multiplayer-navigation-action").click();
  /** Provides subscriptions behavior. */
  const subscriptions = await page.evaluate(() => window.__facebookEvents.filter(event => event === "notifications:subscribe").length);
  for (const result of ["loss", "tie"] as const) {
    outcome = result;
    await page.locator(".live-race-start").click();
    await page.locator(".live-race-victory").waitFor();
    await page.locator(".race-close").click();
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    expect(records).toHaveLength(0);
    expect(contextRecords).toHaveLength(0);
    expect(await page.evaluate(() => window.__facebookEvents.filter(event => event === "notifications:subscribe").length)).toBe(subscriptions);
  }
  outcome = "win"; solves = 10;
  /** Provides confirmation behavior. */
  /** The retained context capability records the eligible score independently of tournament removal. */
  const contextConfirmation = page.waitForResponse("**/recordFacebookContextRun");
  await page.locator(".live-race-start").click();
  await page.locator(".live-race-victory").waitFor();
  await contextConfirmation;
  expect(await page.evaluate(() => Reflect.get(window, "__removedTournamentCalls"))).toEqual([]);
  expect(records).toEqual([]);
  expect(contextRecords).toEqual([{contextId: "context-old", runId: "d".repeat(64), locale: "fr"}]);
  expect(await page.locator(".race-error").count()).toBe(0);
  await page.locator(".race-close").click();
  await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
  // A forfeit may project a win and completed run while the player solved fewer than ten.
  solves = 9;
  await page.locator(".live-race-start").click();
  await page.locator(".live-race-victory").waitFor();
  await page.locator(".race-close").click();
  await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
  expect(records).toHaveLength(0);
  expect(contextRecords).toHaveLength(1);
  await page.locator(".race-close").click();
}
