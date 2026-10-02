import {expect} from "@jest/globals";
import type {Page, Route} from "@playwright/test";
import {installTournamentPresentation} from "./tournaments.jest-playwright.support";

/** Reload recovers an official score into the existing Meta context without a browser run receipt. */
export async function verifyTournamentScoreRecovery(page: Page, origin: string): Promise<void> {
  await installTournamentPresentation(page);
  await page.addInitScript(() => {
    if (new URL(location.href).searchParams.get("recovered-score") !== "on") return;
    /** Injected Meta SDK supplies the matching provider context without any claimed score. */
    const sdk = window.FBInstant!, startsAtMs = Math.floor(Date.now() / 86400000) * 86400000;
    sdk.getTournamentAsync = async () => ({getID: () => "recovered-meta-tournament",
      getContextID: () => sdk.context!.getID()!, getEndTime: () => (startsAtMs + 86400000) / 1000,
      getPayload: () => ({kind: "rq-race10-tournament-v1", locale: "fr",
        tournamentId: `facebook-race10-fr-${new Date(startsAtMs).toISOString().slice(0, 10)}`,
        startsAtMs, endsAtMs: startsAtMs + 86400000})});
  });
  /** Counts browser score submissions independently of native score presentation. */
  let records = 0;
  /** Unexpected browser submission fails rather than supplying recovery authority. */
  const rejectRecord = async (route: Route) => {
    records++;
    await route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({error: "unavailable"})});
  };
  await page.route("**/recordFacebookTournament", rejectRecord);
  try {
    await page.goto(`${origin}/?harness=race&native-tournament=fr&recovered-score=on`);
    await page.locator(".race-tournaments li").waitFor();
    await page.waitForFunction(() => Reflect.get(window, "__tournamentScore") === 9000);
    expect(await page.evaluate(() => Reflect.get(window, "__tournamentCreates")?.length ?? 0)).toBe(0);
    await page.reload();
    await page.locator(".race-tournaments li").waitFor();
    await page.waitForFunction(() => Reflect.get(window, "__tournamentScore") === 2500);
    expect(records).toBe(0);
    expect(await page.evaluate(() => Reflect.get(window, "__tournamentCreates")?.length ?? 0)).toBe(0);
  } finally {await page.unroute("**/recordFacebookTournament", rejectRecord);}
}
