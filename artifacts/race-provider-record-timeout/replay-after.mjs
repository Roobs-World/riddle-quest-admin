import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root='/home/craig-beswetherick/Documents/riddle-quest';
const require=createRequire(path.join(root,'packages/portal/package.json'));
const ts=require('typescript');
const source=await readFile(path.join(root,'packages/portal/src/play/race/RaceProviderViews.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const file=path.join(root,'artifacts/race-provider-record-timeout/current-provider-views.mjs');
await writeFile(file,compiled);
const {RaceProviderViews}=await import(file);
const board={locale:'en',standings:[],rewardsEnabled:false};
const failures=[];
for(const stage of ['tournaments','inbox']) {
 let now=0,id=0,writes=0,reads=0;
 const timers=new Map();
 const clock={schedule(callback,delay){const key=++id;timers.set(key,{callback,at:now+delay});return key;},cancel(key){timers.delete(key);}};
 const advance=delta=>{now+=delta;for(const [key,timer] of timers)if(timer.at<=now){timers.delete(key);timer.callback();}};
 const adapter={record(){writes++;return new Promise(()=>{});},list(){reads++;return Promise.resolve(board);}};
 const views=new RaceProviderViews({clock,reportError(){}});
 views.enter({locale:'en',[stage==='tournaments'?'tournaments':'contextBoard']:adapter});
 views.record('confirmed-run');views.selectStage(stage);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(reads,1); assert.equal(writes,1);
 advance(30000);views.refresh(stage);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 try{assert.equal(writes,2,'A lost provider completion must release its guard for an explicit view retry');}
 catch(error){failures.push({stage,writes,reads,ownedTimers:timers.size,message:error.message});}
 views.dispose();
}
await writeFile(path.join(root,'artifacts/race-provider-record-timeout/after.json'),JSON.stringify({sourceSha256:(await import('node:crypto')).createHash('sha256').update(source).digest('hex'),failures},null,2)+'\n');
console.log(JSON.stringify({failures},null,2));
assert.equal(failures.length,0,'Provider completion recovery must work after a lost reply');
