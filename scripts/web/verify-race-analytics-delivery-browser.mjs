/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify optional telemetry failure cannot interrupt or reject competitive gameplay.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-analytics-delivery-isolation-"));
const output = path.resolve(root, "artifacts/race-analytics-delivery-isolation");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const authority=createFakeRaceServices(),mode=new URL(location.href).searchParams.get('mode');window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:analytics'){if(mode==='sync')throw new Error('analytics unavailable');return Promise.reject(new Error('analytics unavailable'));}
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace')authority.startRace({...message.payload,prepare:false,includeEvaluation:true}).then(data=>reply(message,'raceStart',data));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if(process.env.RACE_ANALYTICS_DELIVERY_BASELINE==='1'&&id.endsWith('/scripts/fixtures/RetainedRaceHarness.tsx'))
      return readFile(path.join(output,'prior-game.tsx'),'utf8').then(code=>({code,map:null}));
    if (!id.endsWith("/races/hooks/useRaceSession.ts")) return null;
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
  for(const mode of ['sync','async'])for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    {
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode);
      await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().categories.length>0&&!globalThis.testRaceSession.getSnapshot().pending);
      await page.evaluate(()=>window.testRaceSession.begin('mixed'));
      await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='racing');
      await page.evaluate(()=>window.testRaceSession.input('text','APPLE'));
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE');
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:startRace').length),1);
      assert.equal(await page.evaluate(()=>window.commands.some(command=>command.type==='game:analytics')),true);
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[],'Telemetry failure must not escape into browser errors');
      await page.screenshot({path:path.join(output,mode+'-'+viewport.width+'.png'),fullPage:true});
      console.log('Analytics delivery isolation passed: '+mode+' at '+viewport.width+'px.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
