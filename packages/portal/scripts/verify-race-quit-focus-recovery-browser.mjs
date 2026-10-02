import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify dismissing race abandonment restores a connected gameplay focus target.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-quit-focus-recovery-"));
const output = path.resolve(root, "../../artifacts/race-quit-focus-recovery");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,"src/play/race/RaceTo10Game.tsx"))};
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
    if (process.env.RACE_QUIT_FOCUS_BASELINE === "1" && id.endsWith("/play/race/hooks/useRaceDialogFocus.ts"))
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
    for(const mode of ['escape','keep-playing','disabled-trigger']){
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='racing');
      await page.evaluate(()=>window.testRaceSession.input('text','APPLE'));
      const trigger=page.getByRole('button',{name:/^Hint/});await trigger.focus();
      await page.keyboard.press('Escape');await page.locator('.race-quit-dialog').waitFor({state:'visible'});
      await page.waitForFunction(()=>document.activeElement?.classList.contains('race-quit-dialog'));
      if(mode==='disabled-trigger')await trigger.evaluate(element=>{element.disabled=true;});
      if(mode==='escape')await page.keyboard.press('Escape');
      else await page.getByRole('button',{name:'Keep playing',exact:true}).click();
      await page.locator('.race-quit-dialog').waitFor({state:'detached'});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      if(mode==='disabled-trigger')assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('race-screen')),true,'Unavailable trigger must restore the race root');
      else assert.equal(await trigger.evaluate(element=>document.activeElement===element),true,'Closing confirmation must restore its gameplay trigger');
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.race-screen')),true,'Tab must remain in gameplay');
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().quitConfirmationOpen),false);
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE');
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:abandonRace','game:submitRaceGuess','game:startRace'].includes(command.type)).length),0);
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(output,mode+'-'+viewport.width+'.png'),fullPage:true});
      console.log('Quit focus recovery passed: '+mode+' at '+viewport.width+'px.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
