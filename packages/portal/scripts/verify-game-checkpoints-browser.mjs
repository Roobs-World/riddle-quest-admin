import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/game-checkpoints-"));
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, "main.tsx"), `
import React, {useCallback, useReducer, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createInitialGameSession, gameSessionReducer} from ${JSON.stringify(path.join(root, "src/play/gameSession.ts"))};
import {useGameSessionPersistence} from ${JSON.stringify(path.join(root, "src/play/game/hooks/useGameSessionPersistence.ts"))};
import {PlayerProjectionPersistence} from ${JSON.stringify(path.join(root, "src/platform/PlayerProjectionPersistence.ts"))};
const awaiting = new URLSearchParams(location.search).has('awaiting');
const riddle = {riddleId:'checkpoint-1',sessionToken:'00000000-0000-4000-8000-000000000001',
 text:'Clue',answerLength:5,gameMode:'classic',attemptsUsed:awaiting?5:0,hasUsedContinue:false,awaitingContinue:awaiting};
const profile={username:'Guest',coins:200,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1};
const read = key => JSON.parse(localStorage.getItem(key)||'null');
const storage={
 readPreferences:async()=>read('preferences')||{},
 writePreferences:async preferences=>{if(window.failNextPreference){window.failNextPreference=false;throw Error('temporary');}
  await Promise.resolve();localStorage.setItem('preferences',JSON.stringify(preferences));},
 readPlayerData:async()=>read('player'),
 writePlayerData:async data=>localStorage.setItem('player',JSON.stringify(data)),
 clear:async()=>{localStorage.removeItem('player');localStorage.removeItem('preferences');},flush:async()=>{},
};
window.persistence=new PlayerProjectionPersistence(storage,read('player'),read('preferences')||{});
function initial(){return gameSessionReducer(gameSessionReducer(createInitialGameSession(),{
 type:'hostInit',locale:'en',gameMode:'classic',user:null,profile,products:[]}),{type:'loadRiddle',riddle});}
function App(){
 const [state,dispatch]=useReducer(gameSessionReducer,undefined,initial);
 const stateRef=useRef(state);stateRef.current=state;
 const [restoredGame,setRestoredGame]=useState(()=>read('player')?.activeGame||null);
 const onSaveGame=useCallback(game=>{window.lastSaved=game;void window.persistence.update({activeGame:game});},[]);
 window.echoSaved=setRestoredGame;
 useGameSessionPersistence({state,stateRef,restoredGame,dispatch,onSaveGame});
 return <main>
  <button onClick={()=>dispatch({type:'typeLetter',letter:'P'})}>P</button>
  <button onClick={()=>dispatch({type:'typeLetter',letter:'I'})}>I</button>
  <button onClick={()=>dispatch({type:'previewCoinSpend',requestId:'continue-1',amount:100,reason:'continue'})}>Continue preview</button>
  <button onClick={()=>dispatch({type:'confirmCoinSpend',requestId:'continue-1',newCoins:100})}>Confirm Continue</button>
  <output data-testid="draft">{state.currentLetters.join('')}</output>
  <output data-testid="continued">{String(state.engineSnapshot?.hasUsedContinue)}</output>
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);

let browser;
let server;
try {
  await build({root: scratch, configFile: false, logLevel: "error",
    resolve: {alias: {"@riddle-quest/core": path.resolve(root, "../core/src")}}, build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await page.getByRole("button", {name: "P", exact: true}).click();
    await page.waitForFunction(() => window.lastSaved?.currentLetters[0] === "P");
    const delayedEcho = await page.evaluate(() => window.lastSaved);
    await page.getByRole("button", {name: "I", exact: true}).click();
    await page.evaluate(game => window.echoSaved(game), delayedEcho);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("player"))?.activeGame?.currentLetters.join("") === "PI");
    assert.equal(await page.getByTestId("draft").textContent(), "PI");
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-testid="draft"]')?.textContent === "PI");

    await page.evaluate(async () => {
      await Promise.all([window.persistence.updatePreferences({muted: true}), window.persistence.updatePreferences({presenceEnabled: true})]);
      window.failNextPreference = true;
      await window.persistence.updatePreferences({highContrast: true}).catch(() => undefined);
      await window.persistence.updatePreferences({reducedMotion: true});
    });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("preferences"))),
      {muted: true, presenceEnabled: true, highContrast: true, reducedMotion: true});

    await page.evaluate(() => localStorage.removeItem("player"));
    await page.goto(url + "/?awaiting");
    await page.getByRole("button", {name: "Continue preview", exact: true}).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="continued"]')?.textContent === "true");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {configurable: true, value: "hidden"});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("player"))?.activeGame?.awaitingContinue === true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("player")).activeGame.engineSnapshot.hasUsedContinue), false);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-testid="continued"]')?.textContent === "false");
    await page.getByRole("button", {name: "Continue preview", exact: true}).click();
    await page.getByRole("button", {name: "Confirm Continue", exact: true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("player"))?.activeGame?.engineSnapshot.hasUsedContinue === true);
    assert.deepEqual(errors, []);
    console.log(`Checkpoint browser verification passed at ${width}px: reload, delayed save echo, concurrent preferences, failed-write recovery, and Continue acknowledgement.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
