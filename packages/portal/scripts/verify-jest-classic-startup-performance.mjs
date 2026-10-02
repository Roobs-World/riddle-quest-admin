import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

// Actual Jest adapter, with repeatable authority delays and a completed Daily.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv.includes('--baseline');
const output = process.argv.find(arg => arg.endsWith('.json'));
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/jest-classic-load-'));
await writeFile(path.join(scratch, 'index.html'), '<html><body><main id="root">Loading</main><script type="module" src="/main.ts"></script></body></html>');
await writeFile(path.join(scratch, 'main.ts'), `
import {createJestStartupRiddlePreload} from ${JSON.stringify(path.join(root, 'src/jest/startupRiddlePreload.ts'))};
const events=[];const record=name=>events.push({name,time:performance.now()});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const completed=new URLSearchParams(location.search).get('completed')==='1';
const adapter={loadRiddle:async input=>{
  record(input.gameMode+':start');
  await wait(input.gameMode==='challenge'?700:1600);
  record(input.gameMode+':done');
  if(input.gameMode==='challenge'&&completed)throw Object.assign(new Error('already completed'),{code:'daily-completed'});
  return {gameMode:input.gameMode,locale:'en',index:7,riddleId:'issued',sessionToken:'signed',text:'Fixture',answerLength:5};
}};
const startup=createJestStartupRiddlePreload(adapter);
const services=${baseline ? 'adapter' : 'startup.services'};
record('startup:start');
// Both versions begin with successful identity/attestation and the same profile read.
const daily=services.loadRiddle({gameMode:'challenge',locale:'en'}).then(value=>({value}),error=>({error}));
await wait(200);record('profile:ready');
${baseline ? '' : "startup.preloadClassic('en',7);"}
const result=await daily;
if(result.error){if(result.error.code!=='daily-completed')throw result.error;await services.loadRiddle({gameMode:'classic',locale:'en',classicIndex:7});}
record('playable');document.getElementById('root').innerHTML='<button>Play</button>';window.result=events;
`);
let browser, server;
const results=[];
try {
  await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{
    try {
      const pathname=new URL(request.url,'http://localhost').pathname;
      const body=await readFile(path.join(scratch,'dist',pathname==='/'?'index.html':pathname));
      response.writeHead(200,{'content-type':pathname.endsWith('.js')?'text/javascript':'text/html','cache-control':'no-store'});response.end(body);
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const completed of [true,false]){
    const runs=[];
    for(let run=0;run<5;run++){
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/?completed='+Number(completed));
      await page.waitForFunction(()=>Boolean(window.result));
      const events=await page.evaluate(()=>window.result);
      const time=name=>events.find(event=>event.name===name)?.time;
      assert.deepEqual(errors,[]);
      assert.ok(time('playable')>=time('profile:ready'));
      if(completed){assert.ok(time('playable')>=time('classic:done'));assert.equal(events.filter(event=>event.name==='classic:start').length,1);}
      if(!baseline){assert.ok(time('classic:start')>=time('profile:ready'));assert.ok(time('classic:start')<time('challenge:done'));}
      if(!completed&&!baseline)assert.equal(time('classic:done'),undefined,'unfinished optional Classic load must not block Daily');
      runs.push({readyMs:time('playable')-time('startup:start'),events});await context.close();
    }
    const medianReadyMs=runs.map(run=>run.readyMs).sort((a,b)=>a-b)[2];
    const scenario=completed?'daily-completed':'daily-available';
    results.push({scenario,medianReadyMs,runs});console.log(scenario+': '+medianReadyMs.toFixed(1)+'ms');
  }
  if(output)await writeFile(output,JSON.stringify({baseline,conditions:'5 cold browser contexts; starts after successful identity/attestation; 200ms server profile, 700ms Daily, 1600ms Classic; actual Jest startup riddle adapter',results},null,2)+'\n');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
