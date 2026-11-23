/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify multiplayer dialog shortcuts preserve composition and consumed keyboard events.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-dialog-keyboard-ownership-"));
const output = path.resolve(process.env.RACE_DIALOG_KEYBOARD_REPORT_DIR ?? path.join(root, "artifacts/race-dialog-keyboard-ownership"));
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/fixtures/RetainedRaceHarness.tsx"))};
const now=Date.now(),view={runId:'keyboard-run',role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'A clue',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace')window.dispatchEvent(
 new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,
 payload:{operation:'raceResume',ok:true,data:{run:view}}}}));}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_DIALOG_KEYBOARD_BASELINE === "1" && id.endsWith("/play/race/hooks/useRaceDialogFocus.ts"))
      return readFile(path.join(output,"prior-dialog-focus.ts"),"utf8").then(code=>({code,map:null}));
    if (!id.endsWith("/play/race/hooks/useRaceSession.ts")) return null;
    assert(code.includes("const session = sessionRef.current;"));
    return {code: code.replace("const session = sessionRef.current;", "const session = sessionRef.current; globalThis.testRaceSession = session;"), map: null};
  }}], root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
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
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    for(const mode of process.env.RACE_DIALOG_KEYBOARD_MODE?[process.env.RACE_DIALOG_KEYBOARD_MODE]:['composing-open','prevented-open','composing-quit','prevented-quit','ordinary']){
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='racing');
      await page.evaluate(()=>window.testRaceSession.input('text','APPLE'));
      await page.waitForFunction(()=>window.testRaceSession.getSnapshot().currentLetters.join('')==='APPLE');
      const initiallyOpen=mode.endsWith('-quit');
      if(initiallyOpen){await page.keyboard.press('Escape');await page.locator('.race-quit-dialog').waitFor({state:'visible'});}
      if(mode==='ordinary'){
        await page.keyboard.press('Escape');await page.locator('.race-quit-dialog').waitFor({state:'visible'});
        await page.keyboard.press('Escape');await page.locator('.race-quit-dialog').waitFor({state:'detached'});
      }else await page.evaluate(mode=>{
        const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,isComposing:mode.startsWith('composing')});
        if(mode.startsWith('prevented'))event.preventDefault();
        document.activeElement.dispatchEvent(event);
      },mode);
      // A render turn makes the assertion cover the DOM as well as the synchronous session state.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().quitConfirmationOpen),initiallyOpen,mode+' must preserve dialog ownership');
      assert.equal(await page.locator('.race-quit-dialog').count(),initiallyOpen?1:0);
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE');
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:abandonRace','game:submitRaceGuess','game:startRace'].includes(command.type)).length),0);
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(output,mode+'-'+viewport.width+'.png'),fullPage:true});
      console.log('Dialog keyboard ownership passed: '+mode+' at '+viewport.width+'px.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
