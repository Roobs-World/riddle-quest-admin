import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";
import {createLiveRaceEmulator} from "./live-race-emulator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(process.env.LIVE_PUBLIC_MATCH_REPORT_DIR ?? path.join(root, "../../artifacts/live-public-match-2026-10-17"));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-public-match-"));
const authority = await createLiveRaceEmulator();
const requests = [];
const observations = [];
let server, browser;
try {
  await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
  await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, "main.tsx"), `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const user=new URLSearchParams(location.search).get('user');
const services=createFakeRaceServices();window.views=[];window.invites=0;window.challengeReads=0;window.legacyFinds=0;
const call=async(operation,input)=>{const response=await fetch('/live/'+operation,{method:'POST',body:JSON.stringify({user,...input})});
  if(!response.ok)throw new Error('Live authority rejected '+operation);const view=await response.json();window.views.push(view);return view;};
const live={join:input=>call('join',input),update:input=>call('update',input),
  shareChallenge:async()=>{window.invites++;return 'success';},
  challenge:async()=>{window.challengeReads++;throw new Error('Public entry must not read a private invitation');}};
async function postToHost(message){if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{
  detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
createRoot(document.getElementById('root')).render(<React.StrictMode><RaceTo10Game locale='en' ownerId={user} coins={100}
  matchmaking={{find:async()=>{window.legacyFinds++;return {status:'cancelled'};},live}} postToHost={postToHost} onClose={()=>{}}/></React.StrictMode>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname.startsWith("/live/")) {
        let body = "";
        for await (const chunk of request) body += chunk;
        const input = JSON.parse(body), operation = pathname.slice("/live/".length);
        requests.push({operation, ...input});
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await authority.call(operation, input)));
        return;
      }
      const file = path.join(scratch, "dist", pathname === "/" ? "index.html" : pathname);
      response.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : file.endsWith(".png") ? "image/png" : "text/html");
      response.end(await readFile(file));
    } catch (error) {console.error(error);response.writeHead(500).end("Public-match verification transport failure");}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true});
  for (const width of [1280, 390]) {
    await authority.reset();
    requests.length = 0;
    const contexts = await Promise.all(["Alice", "Bob"].map(() => browser.newContext({viewport: {width, height: 900}})));
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const [index, page] of pages.entries()) {
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://live-race.invalid/**", route => route.fulfill({status: 404, body: "No test avatar"}));
      await page.goto(baseUrl + "/?user=" + ["Alice", "Bob"][index]);
      await page.getByRole("button", {name: "History People, events, and eras from the past", exact: true}).click();
      await page.getByRole("button", {name: "Challenge a friend", exact: true}).waitFor();
    }
    await pages[0].getByRole("button", {name: "Start PvP match", exact: true}).click();
    await pages[0].waitForFunction(() => window.views.at(-1)?.phase === "searching");
    const searching = await authority.publicMatchEvidence();
    assert.equal(searching.seats[0].privateChallenge, false);
    assert.equal(searching.seats[0].matchId, undefined);
    assert.ok(searching.queuedTicketIds.includes(searching.seats[0].ticketId), "Start PvP must join the public queue");
    const originalTicketId = searching.seats[0].ticketId;
    await authority.expireSearch("Alice", 61_000);
    await pages[0].evaluate(() => window.dispatchEvent(new Event("online")));
    await pages[0].waitForFunction(() => window.views.at(-1)?.serverNowMs - (window.views.at(-1)?.searchEndsAtMs - 900_000) >= 60_000);
    assert.equal(await pages[0].evaluate(() => window.views.at(-1)?.phase), "searching", "Public player waiting must outlast the old bot fallback");
    assert.equal(await pages[0].evaluate(() => window.views.at(-1)?.opponent), null);
    const waiting = await pages[0].evaluate(() => ({ticketId: window.views.at(-1).ticketId,
      phase: window.views.at(-1).phase, waitForPlayer: window.views.at(-1).waitForPlayer,
      searchRemainingMs: window.views.at(-1).searchEndsAtMs - window.views.at(-1).serverNowMs,
      opponent: window.views.at(-1).opponent}));
    await pages[0].reload();
    await pages[0].waitForFunction(ticketId => window.views.at(-1)?.ticketId === ticketId && window.views.at(-1)?.phase === "searching", originalTicketId);
    assert.equal(await pages[0].evaluate(() => JSON.parse(localStorage.getItem("riddleQuest:liveRaceLobby")).ticketId), originalTicketId);
    assert.equal((await authority.publicMatchEvidence()).seats[0].ticketId, originalTicketId, "Reload must recover the exact public seat");
    await pages[0].screenshot({path: path.join(output, `searching-${width}.png`), fullPage: true});
    await contexts[0].setOffline(true);
    await pages[1].getByRole("button", {name: "Start PvP match", exact: true}).click();
    await pages[1].waitForFunction(() => window.views.at(-1)?.phase === "countdown");
    await contexts[0].setOffline(false);
    await Promise.all(pages.map(page => page.waitForFunction(() => window.views.at(-1)?.phase === "countdown")));
    const paired = await authority.publicMatchEvidence();
    assert.ok(paired.seats.every(seat => seat.registered && seat.ownerId === seat.uid && !seat.privateChallenge));
    assert.notEqual(paired.seats[0].uid, paired.seats[1].uid);
    assert.notEqual(paired.seats[0].ticketId, paired.seats[1].ticketId);
    assert.equal(paired.seats[0].matchId, paired.seats[1].matchId, "Both public seats must own the same server lobby");
    assert.ok(paired.match.humanPlayers);
    assert.deepEqual(new Set(paired.match.tickets), new Set(paired.seats.map(seat => seat.ticketId)));
    await pages[0].screenshot({path: path.join(output, `countdown-${width}.png`), fullPage: true});
    await Promise.all(pages.map(page => page.locator(".race-gameplay .guess-board").waitFor({timeout: 15_000})));
    for (const [index, page] of pages.entries()) {
      const user = ["Alice", "Bob"][index];
      await page.locator(".guess-row .cell:not([disabled])").first().click();
      await page.keyboard.type(await authority.answer(user));
      await page.locator(".race-actions .submit-action").click();
      await page.waitForFunction(() => window.views.at(-1)?.player.correctCount === 1);
      await pages[1-index].waitForFunction(() => window.views.at(-1)?.opponent.correctCount === 1);
    }
    const counters = await Promise.all(pages.map(page => page.evaluate(() => ({invites: window.invites,
      challengeReads: window.challengeReads, legacyFinds: window.legacyFinds,
      phase: window.views.at(-1).phase, opponentBot: window.views.at(-1).opponent.bot}))));
    assert.ok(counters.every(counter => counter.invites === 0 && counter.challengeReads === 0 && counter.legacyFinds === 0 && !counter.opponentBot && counter.phase === "racing"));
    const joins = requests.filter(request => request.operation === "join");
    assert.equal(joins.length, 3);
    assert.ok(joins.every(join => !join.createChallenge && !join.challengeId && !join.rematchOfTicketId));
    assert.ok(joins.every(join => join.waitForPlayer === true));
    assert.equal(joins.filter(join => join.resumeTicketId === originalTicketId).length, 1);
    assert.deepEqual(errors, []);
    await pages[0].screenshot({path: path.join(output, `gameplay-${width}.png`), fullPage: true});
    observations.push({width, searching, waiting, paired, counters, joins});
    await Promise.all(contexts.map(context => context.close()));
    console.log(`PASS ${width}px: Public waiting outlasted the former bot timeout, reload recovered the same seat, reconnect joined the human countdown, and both answers synchronized without friend invitations.`);
  }
  await writeFile(path.join(output, "evidence.json"), JSON.stringify({environment: "Local browser with injected HTTP transport to real Firestore-emulator authority. This is not hosted Jest end-to-end evidence.", observations}, null, 2) + "\n");
} finally {
  await browser?.close();
  if (server) {server.closeAllConnections();await new Promise(resolve => server.close(resolve));}
  await authority.clear();
  await rm(scratch, {recursive: true, force: true});
}
