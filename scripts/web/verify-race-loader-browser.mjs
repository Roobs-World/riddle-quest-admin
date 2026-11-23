/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Render the real multiplayer UI with a controlled loader timers and guess confirmation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-loader-"));
const output = path.resolve(root, "artifacts/race-loader");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES, SubmitRaceGuessResponseSchema} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/web/play/race/testing/fakeRaceServices.ts"))};
const catalog=createFakeRaceServices();
const deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const prepared=runId=>({runId,role:'creator',status:'prepared',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:0,totalPenaltyMs:0,adjustedElapsedMs:0,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),preparationExpiresAtMs:Date.now()+30000});
let view=prepared('loader-run');window.commands=[];window.tails=[];window.captureTail=false;
const nativeTimeout=window.setTimeout.bind(window);
window.setTimeout=(callback,delay,...args)=>{
 if(window.captureTail&&typeof callback==='function'&&delay>=0&&delay<=180){window.tails.push(callback);return nativeTimeout(()=>{},60000);}
 return nativeTimeout(callback,delay,...args);
};
function reply(message,operation,data){
 window.captureTail=operation==='raceGuess';
 try{window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,
  payload:{operation,ok:true,data}}}));}finally{window.captureTail=false;}
}
function postToHost(message){
 window.commands.push(message);
 if(message.type==='game:listRaceCategories'){void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));return;}
 if(message.type==='game:startRace'){reply(message,'raceStart',{run:view});return;}
 if(message.type==='game:readyRace'){
  const now=Date.now();view={...view,status:'active',startsAtMs:now-1000,serverNowMs:now,wallElapsedMs:1000,adjustedElapsedMs:1000};
  reply(message,'raceReady',{run:view});return;
 }
 if(message.type!=='game:submitRaceGuess')return;
 const now=Date.now(),wall=now-view.startsAtMs,correct=message.payload.guess==='piano';
 view={...view,serverNowMs:now,wallElapsedMs:wall,adjustedElapsedMs:wall,
  currentRiddle:correct?prompt(1):{...prompt(0),guessesUsed:1,guessesRemaining:4},correctCount:correct?1:0,
  events:correct?[{sequence:0,type:'correct',riddlePosition:0,correctCount:1,wallElapsedMs:wall,
   adjustedElapsedMs:wall,totalPenaltyMs:0,penaltyAddedMs:0}]:[]};
 const data=SubmitRaceGuessResponseSchema.parse({run:view,isCorrect:correct,autoSkipped:false,
  feedback:Array.from(message.payload.guess,letter=>({letter,status:correct?'green':'red'}))});
 if(correct)window.confirmCorrect=()=>reply(message,'raceGuess',data);else reply(message,'raceGuess',data);
}
const app=createRoot(document.getElementById('root'));
const render=ownerId=>app.render(<RaceTo10Game locale="en" coins={100} ownerId={ownerId} postToHost={postToHost} onClose={()=>{}}/>);
window.changeOwner=()=>{view=prepared('loader-new-owner');render('owner-2');};render('owner-1');
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const replacement of ["same-run", "new-account"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator(".race-category-grid button").first().click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible",timeout:15000}).catch(async error => {
      console.error(await page.locator("body").innerText(), await page.evaluate(() => window.commands), errors);
      await page.screenshot({path:path.join(output, `failed-${viewport.width}.png`),fullPage:true});
      throw error;
    });
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type("zzzzz");await page.keyboard.press("Enter");
    await page.waitForFunction(()=>window.tails.length===1);
    if(replacement==="new-account"){
      await page.evaluate(()=>window.changeOwner());
      await page.locator(".race-category-grid button").first().click();
      await page.locator(".race-gameplay .guess-board").waitFor({state:"visible"});
      await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    }
    await page.keyboard.type("piano");await page.keyboard.press("Enter");
    await page.waitForFunction(()=>typeof window.confirmCorrect==='function').catch(async error=>{console.error(await page.locator('body').innerText(),await page.evaluate(()=>window.commands),errors);throw error;});
    await page.evaluate(()=>window.confirmCorrect());
    await page.waitForFunction(()=>window.tails.length===2);
    await page.locator(".race-operation-loader").waitFor({state:"visible"});
    await page.evaluate(()=>window.tails[0]());
    assert.equal(await page.locator(".race-operation-loader").isVisible(),true);
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(),"Question 2");
    assert.equal(await page.getByRole("alert").count(),0);
    await page.screenshot({path:path.join(output,`${replacement}-protected-${viewport.width}.png`),fullPage:true});
    await page.evaluate(()=>window.tails[1]());
    await page.locator(".race-operation-loader").waitFor({state:"hidden"});
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(),"Question 2");
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${replacement}-settled-${viewport.width}.png`),fullPage:true});
    console.log(`Loader UI passed: ${viewport.width}px, ${replacement}; obsolete callback cannot hide the newer loader, current callback settles normally.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
