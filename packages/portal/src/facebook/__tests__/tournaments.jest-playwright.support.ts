import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";
import type {FacebookInstantTournament} from "../fbinstant";

/** Adds an authenticated board and Meta-native tournament contract to the actual production artifact. */
export async function installTournamentPresentation(page: Page): Promise<void> {
  /** The first displayed score is deliberately older than the fresh score used by a share. */
  let reads = 0;
  await page.route("**/listFacebookTournament", async route => {
    /** Locale comes from the real authenticated client request. */
    const {locale} = route.request().postDataJSON().data;
    /** Current UTC day mirrors the authoritative backend contract. */
    const startsAtMs = Math.floor(Date.now() / 86400000) * 86400000;
    /** One current-player row carries no UID, name or reward. */
    const currentPlayer = {rank: 1, adjustedTimeMs: ++reads === 1 ? 9000 : 2500, isCurrentPlayer: true};
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {
      tournamentId: `facebook-race10-${locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`, locale,
      startsAtMs, endsAtMs: startsAtMs + 86400000, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
      standings: [currentPlayer], currentPlayer,
    }})});
  });
  await page.addInitScript(() => {
    /** Preserve the identity/context/notification/ads inventory owned by the surrounding fixture. */
    const sdk = window.FBInstant!;
    /** Native entry URLs exist only in this injected fixture, never in the production parser. */
    const incoming = new URL(location.href).searchParams.get("native-tournament");
    if (incoming) sdk.getEntryPointData = () => {
      /** Real native invitations carry the same bounded UTC envelope produced by native sharing. */
      const startsAtMs = Math.floor(Date.now() / 86400000) * 86400000;
      /** A poisoned envelope exercises rejection without changing the ordinary launch fixture. */
      const locale = incoming === "invalid" ? "fr" : incoming;
      return {kind: "rq-race10-tournament-v1", locale,
        tournamentId: `facebook-race10-${locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`,
        startsAtMs, endsAtMs: startsAtMs + 86400000, ...(incoming === "invalid" ? {coins: 999} : {})};
    };
    /** Exact native inventory is advertised before application bootstrap. */
    const supported = sdk.getSupportedAPIs.bind(sdk);
    sdk.getSupportedAPIs = () => [...supported(), "getTournamentAsync", "tournament.createAsync", "tournament.shareAsync", "tournament.postScoreAsync"];
    /** No native tournament exists until the player confirms creation. */
    let native: FacebookInstantTournament | undefined;
    sdk.getTournamentAsync = async () => {
      if (!native) throw {code: "TOURNAMENT_NOT_FOUND"};
      return native;
    };
    sdk.tournament = {
      createAsync: payload => {
        Reflect.set(window, "__tournamentCreates", [...(Reflect.get(window, "__tournamentCreates") ?? []), payload]);
        return new Promise(resolve => {
          Reflect.set(window, "__finishTournamentCreate", () => {
            /** The native object retains the provider context selected at confirmation. */
            const context = sdk.context!.getID()!;
            native = {getID: () => "native-browser-tournament", getContextID: () => context,
              getEndTime: () => payload.config.endTime,
              getPayload: () => Reflect.get(window, "__tournamentPayloadOverride") ?? payload.data};
            resolve(native);
          });
        });
      },
      shareAsync: async payload => {
        Reflect.set(window, "__tournamentShares", [...(Reflect.get(window, "__tournamentShares") ?? []), payload]);
      },
      postScoreAsync: async score => {Reflect.set(window, "__tournamentScore", score);},
    };
  });
}

/** Proves the localized control, fresh authority, duplicate protection and exact native payloads. */
export async function verifyTournamentPresentation(page: Page): Promise<void> {
  await page.getByRole("tab", {name: "Tournois", exact: true}).click();
  await page.locator(".race-tournaments li").waitFor();
  expect(await page.locator(".race-tournaments").innerText()).toContain("0:09.0");
  /** French restored preferences drive the new button and native title. */
  const share = page.getByRole("button", {name: "Partager le tournoi", exact: true});
  await share.evaluate((button: HTMLElement) => {button.click(); button.click();});
  await page.waitForFunction(() => Reflect.get(window, "__tournamentCreates")?.length === 1);
  expect(await share.isDisabled()).toBe(true);
  /** Native publication contains no provider/player/run IDs or inferred grants. */
  const payload = await page.evaluate(() => Reflect.get(window, "__tournamentCreates")[0]);
  expect(payload.initialScore).toBe(2500);
  expect(payload.config).toMatchObject({title: "Tournois", sortOrder: "LOWER_IS_BETTER", scoreFormat: "NUMERIC"});
  expect(payload.config.image).toMatch(/^data:image\/png;base64,/u);
  expect(payload.config.endTime).toBe(payload.data.endsAtMs / 1000);
  expect(Object.keys(payload.data).sort()).toEqual(["endsAtMs", "kind", "locale", "startsAtMs", "tournamentId"]);
  expect(payload.data.locale).toBe("fr");
  expect(payload.data.endsAtMs - payload.data.startsAtMs).toBe(86400000);
  await page.evaluate(() => Reflect.get(window, "__finishTournamentCreate")());
  await page.waitForFunction(() => !document.querySelector(".race-tournaments button")?.hasAttribute("disabled"));
  await page.waitForFunction(() => document.querySelector(".race-tournaments")?.textContent?.includes("0:02.5"));
  await share.click();
  await page.waitForFunction(() => Reflect.get(window, "__tournamentShares")?.length === 1);
  expect(await page.evaluate(() => Reflect.get(window, "__tournamentShares")[0])).toEqual({score: 2500, data: payload.data});
  expect(await page.evaluate(() => Reflect.get(window, "__tournamentCreates").length)).toBe(1);
  await page.waitForFunction(() => !document.querySelector(".race-tournaments button")?.hasAttribute("disabled"));
  /** Touch target and separated rank/time columns are verified in the real artifact CSS. */
  expect((await share.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".race-tournaments li").evaluate(row => {
    /** Ordered-list markers are suppressed because the server already supplies ranks, including ties. */
    const rank = row.querySelector("strong")!.getBoundingClientRect();
    /** Elapsed time retains left-to-right numeric ordering in every content locale. */
    const time = row.querySelector("span")!.getBoundingClientRect();
    return {separated: time.left > rank.right, listStyle: getComputedStyle(row.parentElement!).listStyleType};
  })).toEqual({separated: true, listStyle: "none"});
  await page.screenshot({path: "/tmp/facebook-native-tournament-390.png"});
  await page.setViewportSize({width: 1280, height: 800});
  await page.screenshot({path: "/tmp/facebook-native-tournament-1280.png"});
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(data => Reflect.set(window, "__tournamentPayloadOverride", {...data, locale: "en"}), payload.data);
  await share.click();
  await page.getByRole("alert").waitFor();
  expect(await page.getByRole("alert").innerText()).toContain("autre langue");
  expect(await page.evaluate(() => Reflect.get(window, "__tournamentShares").length)).toBe(1);
  await page.evaluate(() => Reflect.deleteProperty(window, "__tournamentPayloadOverride"));
  await share.click();
  await page.waitForFunction(() => Reflect.get(window, "__tournamentShares")?.length === 2);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.getByRole("tab").first().click();
}

/** Incoming native data selects only a configured presentation destination, never score/locale authority. */
export async function verifyTournamentEntry(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/?harness=race&native-tournament=fr`);
  await page.locator(".race-tournaments li").waitFor();
  expect(await page.getByRole("tab", {name: "Tournois", exact: true}).getAttribute("aria-selected")).toBe("true");
  expect(await page.locator(".race-tournaments").innerText()).toContain("0:02.5");
  expect(await page.evaluate(() => Reflect.get(window, "__tournamentCreates")?.length ?? 0)).toBe(0);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.goto(`${origin}/?harness=race&native-tournament=en`);
  await page.locator(".race-tournaments li").waitFor();
  expect(await page.getByRole("alert").innerText()).toContain("autre langue");
  expect(await page.getByRole("tab", {name: "Tournois", exact: true}).getAttribute("aria-selected")).toBe("true");
  expect(await page.evaluate(() => Reflect.get(window, "__tournamentCreates")?.length ?? 0)).toBe(0);
  /** Authenticated feature disable prevents the invitation from opening an unsupported social surface. */
  await page.goto(`${origin}/?harness=race&native-tournament=fr&tournaments=off`);
  await page.waitForFunction(() => window.__facebookEvents.includes("read:riddleQuestPlayerState"));
  await page.locator(".game-bottom-navigation").waitFor();
  expect(await page.locator(".race-tournaments").count()).toBe(0);
  expect(await page.getByRole("tab", {name: "Tournois", exact: true}).count()).toBe(0);
  /** Extra score/coin fields reject the whole native destination without creating a challenge. */
  await page.goto(`${origin}/?harness=race&native-tournament=invalid`);
  await page.waitForFunction(() => window.__facebookEvents.includes("read:riddleQuestPlayerState"));
  await page.locator(".game-bottom-navigation").waitFor();
  expect(await page.locator(".race-tournaments").count()).toBe(0);
  expect(await page.locator(".race-challenge-card").count()).toBe(0);
}
