import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const mode = process.env.JEST_LIVE_INVITE_REACT_MODE ?? "development";
assert.ok(["development", "production"].includes(mode));
const output = path.resolve(process.env.JEST_LIVE_INVITE_REPORT_DIR ?? path.join(root, "artifacts/multiplayer-jest-invite-2026-10-17", mode));
const baseline = process.env.JEST_LIVE_INVITE_BASELINE_SOURCE;
const officialSdkPath = process.env.JEST_LIVE_INVITE_OFFICIAL_SDK_PATH;
if (officialSdkPath) assert.ok(path.isAbsolute(officialSdkPath), "The official SDK fixture path must be absolute");
const officialSdk = officialSdkPath ? await readFile(officialSdkPath) : null;
const sdkMode = officialSdk ? "official-sdk-bridge" : "adapter-stub";
const sdkSha256 = officialSdk ? createHash("sha256").update(officialSdk).digest("hex") : null;
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/jest-live-invite-"));
let server, browser;
const observations = [];
try {
  await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
  await writeFile(path.join(scratch, "index.html"), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>' +
    (officialSdk ? '<script src="/jestsdk.js"></script>' : '') + '<script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, "main.tsx"), `
import React from "react";
import {createRoot} from "react-dom/client";
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/races/components/recorded/RaceTo10Game.tsx"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root, "src/sharing/components/ReferralSharingCapability.tsx"))};
import {useJestSharing} from ${JSON.stringify(path.join(root, "platforms/web/jest/src/sharing/useJestSharing.ts"))};
import {JestSdkPlatform} from ${JSON.stringify(path.join(root, "platforms/web/jest/src/JestSdkPlatform.ts"))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root, "platforms/web/jest/src/notifications/operationGate.ts"))};
import {useJestPlatformActivity} from ${JSON.stringify(path.join(root, "platforms/web/jest/src/useJestPlatformOperations.ts"))};
import {parseEntryIntent} from ${JSON.stringify(path.join(root, "platforms/web/jest/src/entryIntent.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, "src/settings/browser/playerPreferences.ts"))};
import {createLiveRaceLobbyStorage} from ${JSON.stringify(path.join(root, "src/races/browser/storage/liveRaceLobbyStorage.ts"))};
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
applyPlayerPreferences({locale: "en", muted: true, reducedMotion: true, onboardingComplete: true});
window.probe = {shares: [], joins: [], events: [], initialized: false, inClick: false};
document.addEventListener("click", () => {window.probe.inClick = true;}, true);
document.addEventListener("click", () => {window.probe.inClick = false;});
const registered = new URL(location.href).searchParams.get("registered") === "1";
const session = {firebaseUid: "jest-invite-fixture", firebaseAuthenticated: true,
  player: {playerId: "invite-fixture", registered}, profile: registered ? {username: "Stella"} : null,
  entryIntent: {}, preferences: {}, playerData: null};
let platform;
if (${Boolean(officialSdk)}) {
  const contextId = "jest-live-invite-fixture";
  const reply = message => window.postMessage({source_channel: "textclub", ...message}, location.origin);
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.source_channel !== "textclub" || message.sdkContextId !== contextId) return;
    window.probe.sdkVersion = message.sdkVersion;
    if (message.type === "Initialized") {
      reply({type: "SetPlayer", player: {playerId: "invite-fixture", registered,
        username: registered ? "Stella" : null, avatarUrl: null, entryPayload: {}, playerData: {}},
        profile: session.profile, entrySource: {type: "direct"}});
    } else if (message.type === "ShareReferralLink") {
      const {reference, entryPayload, shareTitle, shareText, onboardingSlug, notificationTemplates, shareImage} = message;
      window.probe.events.push("sdk-share");
      window.probe.shares.push({input: {reference, entryPayload, shareTitle, shareText, onboardingSlug, notificationTemplates, shareImage},
        initialized: window.probe.initialized, bridgeMessage: structuredClone(message)});
      window.settleShare = outcome => reply({type: "ShareReferralLinkResponse", conversationId: message.conversationId,
        success: outcome !== "error", canceled: outcome === "cancelled", error: "Injected Jest dialog failure"});
    } else if (message.type === "GetReferrals") {
      reply({type: "GetReferralsResponse", conversationId: message.conversationId, success: true,
        referrals: {}, referralsSigned: "fixture"});
    }
  });
  platform = new JestSdkPlatform();
} else {
platform = new JestSdkPlatform({init: async () => {window.probe.initialized = true;},
  social: {setScreenshotProvider: () => {}},
  referrals: {listReferrals: async () => ({referralsSigned: "fixture"}), shareReferralLink: input => {
    window.probe.events.push("sdk-share");
    window.probe.shares.push({input: structuredClone(input), inClick: window.probe.inClick, initialized: window.probe.initialized});
    return new Promise((resolve, reject) => {window.settleShare = outcome => {
      if (outcome === "error") reject(Error("Injected Jest dialog failure"));
      else resolve({canceled: outcome === "cancelled"});
    };});
  }}});
}
const initialization = await platform.init();
if (initialization.status !== "success") throw Error(initialization.message ?? "Jest SDK initialization failed");
window.probe.initialized = true;
const gate = createNotificationOperationGate({deletionPending: () => false, deletionEpoch: () => null});
const backend = {verifyReferrals: async () => ({conversionCount: 0, rewardsGranted: 0})};
const categories = [{categoryId: "mixed", nameKey: "RaceTo10.CATEGORY_MIXED_NAME",
  descriptionKey: "RaceTo10.CATEGORY_MIXED_DESCRIPTION", icon: "shuffle", colorToken: "#6875F5", availableRiddleCount: 30}];
let generation = 0, visit = 0, activeChallenge;
const challengeId = () => "live_" + (generation ? "b" : "a").repeat(64);
const player = {displayName: "Stella", avatarUrl: null, bot: false, correctCount: 0};
const snapshot = () => ({ticketId: "c".repeat(64), phase: "searching", serverNowMs: Date.now(),
  searchEndsAtMs: Date.now() + 900000, startsAtMs: null, player, opponent: null, run: null, result: null,
  rewardCoins: 0, ...(activeChallenge ? {challengeId: activeChallenge} : {})});
const transport = {join: async input => {
    window.probe.joins.push(structuredClone(input));
    window.probe.events.push(input.createChallenge ? "reserve-private" : input.challengeId ? "accept-private" : "join-public");
    activeChallenge = input.challengeId ?? (input.createChallenge ? challengeId() : null);
    if (input.createChallenge) await new Promise(resolve => {window.reserveLobby = () => {
      window.reserveLobby = null; window.probe.events.push("reserved-private"); resolve();
    };});
    return snapshot();
  },
  sendChallenge: async () => ({status: "queued"}),
  update: async input => ({...snapshot(), ...(input.action === "leave" ? {phase: "cancelled"} : {})}),
  challenge: async ({challengeId}) => ({challengeId, locale: "en", categoryId: "mixed", creator: player,
    expiresAtMs: Date.now() + 900000, status: "available"})};
const matchmaking = {live: transport};
const appRoot = createRoot(document.querySelector("#root"));
function App({incoming}) {
  const activity = useJestPlatformActivity(gate);
  const sharing = useJestSharing({locale: "en", session, platform, backend,
    sharingEnabled: gate.isOpen, ...activity, trackFunnel: () => {}});
  return <ReferralSharingProvider capability={sharing}><RaceTo10Game locale="en" coins={100}
    ownerId={session.firebaseUid} initialCategories={categories} matchmaking={matchmaking}
    challengeId={incoming} postToHost={() => {}} onClose={() => {}} /></ReferralSharingProvider>;
}
const render = incoming => appRoot.render(<React.StrictMode><App key={++visit} incoming={incoming} /></React.StrictMode>);
window.fixture = {restart: () => render(), next: () => {createLiveRaceLobbyStorage(session.firebaseUid).clear(); generation++; render();},
  closeGate: gate.close,
  receive: payload => render(parseEntryIntent(payload).challengeId)};
render();
`);
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error",
    define: {"process.env.NODE_ENV": JSON.stringify(mode)},
    plugins: [{name: "jest-live-invite-baseline", enforce: "pre", async load(id) {
      if (baseline && id.endsWith("/jest/sharing/useJestSharing.ts")) return readFile(baseline, "utf8");
    }}], build: {outDir: "dist", target: "esnext"}});
  server = createServer(async (req, res) => {
    try {
      const name = new URL(req.url, "http://localhost").pathname;
      if (officialSdk && name === "/jestsdk.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(officialSdk);
        return;
      }
      const file = path.join(scratch, "dist", name === "/" ? "index.html" : name);
      const contentTypes = {".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
        ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html"};
      res.setHeader("content-type", contentTypes[path.extname(file)] ?? "application/octet-stream");
      res.end(await readFile(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  browser = await chromium.launch({headless: true});
  for (const width of [320, 390, 1280]) for (const registered of [false, true]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?registered=${registered ? 1 : 0}${officialSdk ? "&sid=jest-live-invite-fixture" : ""}`);
    const invite = page.locator(".live-race-invite-share > button");
    const introInvite = page.getByRole("button", {name: "Challenge a friend", exact: true});
    const buttonStyle = button => button.evaluate(element => {
      const css = getComputedStyle(element);
      return Object.fromEntries(["minHeight", "padding", "border", "borderRadius", "color", "backgroundColor",
        "boxShadow", "fontFamily", "fontSize", "fontWeight", "lineHeight", "cursor"].map(key => [key, css[key]]));
    });
    const focusStyle = async button => {
      await page.keyboard.press("Tab");
      await button.focus();
      return button.evaluate(element => {
        const css = getComputedStyle(element);
        return {outline: css.outline, offset: css.outlineOffset, visible: element.matches(":focus-visible")};
      });
    };
    await introInvite.waitFor();
    await page.getByRole("button", {name: "Start PvP match", exact: true}).click();
    await page.waitForFunction(() => window.probe.joins.length === 1);
    assert.equal(await page.evaluate(() => window.probe.joins[0].createChallenge), undefined,
      "Start PvP match requests public matchmaking");
    assert.equal(await page.evaluate(() => window.probe.joins[0].challengeId), undefined,
      "Start PvP match does not target a private lobby");
    assert.equal(await page.evaluate(() => window.probe.shares.length), 0,
      "Start PvP match does not open the Jest sharing dialog");
    assert.equal(await invite.count(), 0, "Public matchmaking does not render a private-lobby invite");
    await page.evaluate(() => window.fixture.restart());
    await introInvite.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const introStyle = await buttonStyle(introInvite);
    const introFocus = await focusStyle(introInvite);
    assert.equal(introFocus.visible, true);
    await page.screenshot({path: path.join(output, `intro-${width}-${registered ? "registered" : "guest"}.png`)});
    await introInvite.click();
    await page.waitForFunction(() => typeof window.reserveLobby === "function");
    assert.equal(await page.evaluate(() => window.probe.joins.length), 2, "First friend click makes one private reservation");
    assert.equal(await page.evaluate(() => window.probe.joins[1].createChallenge), true,
      "Challenge a friend reserves a private lobby");
    assert.equal(await page.evaluate(() => window.probe.shares.length), 0,
      "Jest sharing waits for the authoritative lobby handle");
    await page.evaluate(() => window.reserveLobby());
    await invite.waitFor();
    await page.waitForFunction(() => window.probe.shares.length === 1 && typeof window.settleShare === "function");
    assert.deepEqual(await page.evaluate(() => window.probe.events.slice(1)),
      ["reserve-private", "reserved-private", "sdk-share"],
      "The first friend click reserves the private lobby and automatically opens Jest sharing without a second click");
    const checkShare = async (index, expectedChallenge, directClick) => {
      const call = await page.evaluate(index => window.probe.shares[index], index);
      if (officialSdk) {
        assert.equal(call.bridgeMessage.type, "ShareReferralLink");
        assert.equal(call.bridgeMessage.source_channel, "textclub");
        assert.equal(call.bridgeMessage.sdkContextId, "jest-live-invite-fixture");
        assert.equal(typeof call.bridgeMessage.sdkVersion, "string");
        assert.ok(call.bridgeMessage.sdkVersion.length > 0);
        assert.match(call.bridgeMessage.conversationId, /^shareReferralLink_/);
      } else {
        assert.equal(call.inClick, directClick, "Automatic sharing follows reservation; manual retries remain in the click dispatch");
      }
      assert.equal(call.initialized, true);
      assert.match(call.input.reference, /^rq_r10_v1_[a-f0-9]{16}$/);
      assert.equal(call.input.shareTitle, "Challenge a friend");
      assert.ok(call.input.shareText.includes(registered ? "Stella" : call.input.entryPayload.inviterName));
      assert.deepEqual(call.input.entryPayload, {inviteKind: "race", campaign: "live_pvp_v1",
        challengeDestination: "multiplayer", challengeId: expectedChallenge, inviterName: registered ? "Stella" : "Solver"});
      assert.equal(await invite.isDisabled(), true);
      const count = await page.evaluate(() => window.probe.shares.length);
      await invite.evaluate(button => button.click());
      assert.equal(await page.evaluate(() => window.probe.shares.length), count, "Pending Jest dialog excludes duplicates");
      return call.input;
    };
    const original = await checkShare(0, "live_" + "a".repeat(64), false);
    await page.evaluate(() => window.settleShare("cancelled"));
    await page.waitForFunction(() => !document.querySelector(".live-race-invite-share > button")?.disabled);
    assert.equal(await page.locator(".live-race-invite-share [role=alert]").count(), 0,
      "Cancelling the automatic Jest dialog keeps the lobby available for retry");
    const directInvite = page.locator(".live-race-direct-invite > button");
    await page.locator(".live-race-direct-invite input").fill("Friend");
    assert.deepEqual(await buttonStyle(invite), introStyle, "Lobby and category invites use the same button style");
    assert.deepEqual(await buttonStyle(directInvite), introStyle, "Username invites use the same button style");
    assert.deepEqual(await focusStyle(invite), introFocus, "Lobby invites use the same keyboard focus style");
    assert.deepEqual(await focusStyle(directInvite), introFocus, "Username invites use the same keyboard focus style");
    const nativeBounds = await invite.boundingBox(), directBounds = await directInvite.boundingBox();
    assert.equal(nativeBounds.width, directBounds.width, "Lobby invite buttons have the same width");
    for (const bounds of [nativeBounds, directBounds]) {
      assert.ok(bounds.height >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width, "Invite buttons fit the viewport");
    }
    for (const outcome of ["error", "success"]) {
      const before = await page.evaluate(() => window.probe.shares.length);
      await invite.click();
      await page.waitForFunction(before => window.probe.shares.length === before + 1, before);
      await checkShare(before, original.entryPayload.challengeId, true);
      await page.evaluate(outcome => window.settleShare(outcome), outcome);
      await page.waitForFunction(() => !document.querySelector(".live-race-invite-share > button")?.disabled);
      assert.equal(await page.locator(".live-race-invite-share [role=alert]").count(), outcome === "error" ? 1 : 0);
    }
    await page.evaluate(() => window.fixture.next());
    await page.locator('[data-analytics-screen="multiplayer_live_intro"]').waitFor();
    await page.getByRole("button", {name: "Challenge a friend", exact: true}).click();
    await page.waitForFunction(() => typeof window.reserveLobby === "function");
    assert.equal(await page.evaluate(() => window.probe.shares.length), 3);
    await page.evaluate(() => window.reserveLobby());
    await invite.waitFor();
    await page.waitForFunction(() => window.probe.shares.length === 4);
    const next = await checkShare(3, "live_" + "b".repeat(64), false);
    assert.notEqual(next.reference, original.reference, "A new lobby never overwrites an older invite link");
    await page.evaluate(() => window.settleShare("error"));
    await page.locator(".live-race-invite-share [role=alert]").waitFor();
    await page.waitForFunction(() => !document.querySelector(".live-race-invite-share > button")?.disabled);
    await invite.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.probe.shares.length === 5);
    await checkShare(4, next.entryPayload.challengeId, true);
    await page.evaluate(() => window.settleShare("cancelled"));
    await page.waitForFunction(() => !document.querySelector(".live-race-invite-share > button")?.disabled);
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".race-screen img"))
      .every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({path: path.join(output, `lobby-${width}-${registered ? "registered" : "guest"}.png`)});
    await page.evaluate(() => window.fixture.closeGate());
    await invite.click();
    await page.locator(".live-race-invite-share [role=alert]").waitFor();
    assert.equal(await page.evaluate(() => window.probe.shares.length), 5, "Account deletion blocks new dialogs");
    await page.evaluate(payload => window.fixture.receive(payload), original.entryPayload);
    await page.waitForFunction(() => window.probe.joins.length === 4);
    const joins = await page.evaluate(() => window.probe.joins);
    assert.equal(joins[1].createChallenge, true);
    assert.equal(joins[3].challengeId, original.entryPayload.challengeId);
    assert.equal(joins[3].createChallenge, undefined, "Recipient joins the shared lobby instead of creating another one");
    assert.equal(await page.evaluate(() => window.probe.shares.length), 5,
      "Accepting an incoming invitation does not open another share dialog");
    assert.deepEqual(errors, []);
    observations.push({mode, sdkMode, sdkVersion: await page.evaluate(() => window.probe.sdkVersion ?? null), sdkSha256,
      sdkSource: officialSdk ? "https://cdn.jest.com/sdk/latest/jestsdk.js" : null,
      width, registered, outcomes: ["cancelled", "error", "success"], firstClickOpensJestSdk: true,
      publicMatchmakingDoesNotShare: true, privateReservationBeforeShare: true, automaticFailureCanRetry: true,
      immutableInvites: true, recipientJoinedOriginalLobby: true, accountDeletionBlocked: true,
      matchingInviteStyles: introStyle, lobbyInviteWidth: nativeBounds.width});
    await context.close();
    console.log(`PASS ${mode} ${sdkMode} Jest friend invitation at ${width}px, ${registered ? "registered" : "guest"}`);
  }
  await writeFile(path.join(output, "browser.json"), JSON.stringify(observations, null, 2) + "\n");
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
