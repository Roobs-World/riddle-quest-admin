import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.PANEL_COMMIT_REACT_MODE??'development',baseline=process.env.PANEL_COMMIT_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.PANEL_COMMIT_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-panel-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-panel-commit-'));let browser,server;const observations=[];
const components=['LiveRaceInbox','LiveRaceInvitationCard','LiveRaceDirectInvite','LiveRaceSafety'];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
${components.map(name=>'import {'+name+'} from '+JSON.stringify(path.join(root,'src/play/race/components',name+'.tsx'))+';').join('\n')}
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const kind=new URL(location.href).searchParams.get('kind')??'direct-input';window.probe={calls:[],reads:[],pending:[],accepted:[],blocked:[],suspended:0,errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const id='live_'+'a'.repeat(64),row=owner=>({challengeId:id,locale:'en',categoryId:'mixed',creator:{displayName:owner,avatarUrl:null,bot:false,correctCount:0},expiresAtMs:Date.now()+900000,status:'available'});
function delivery(owner,action,input){window.probe.calls.push({owner,action,input:{...input}});return new Promise(resolve=>window.probe.pending.push({owner,action,resolve,settled:false}));}
function provider(owner){return {inbox:async()=>{window.probe.reads.push({owner,action:'inbox'});if(window.holdReads)return new Promise(resolve=>window.probe.pending.push({owner,action:'inbox',resolve,settled:false}));return [row(owner)];},challenge:async()=>{window.probe.reads.push({owner,action:'challenge'});if(window.holdReads)return new Promise(resolve=>window.probe.pending.push({owner,action:'challenge',resolve,settled:false}));return row(owner);},sendChallenge:input=>delivery(owner,'direct',input),reportOpponent:input=>delivery(owner,'report',input),blockOpponent:input=>delivery(owner,'block',input)};}
const transports={Alice:provider('Alice'),Bob:provider('Bob')},rows={Alice:row('Alice'),Bob:row('Bob')};
window.release=()=>{for(const p of window.probe.pending)if(!p.settled){p.settled=true;p.resolve(p.action==='direct'?{status:'queued'}:p.action==='block'?{blocked:true}:p.action==='report'?{queued:true,reportId:'accepted-report'}:p.action==='inbox'?[row(p.owner)]:row(p.owner));}};
let unblock;const pending=new Promise(resolve=>unblock=resolve);window.allow=false;function Pending(){window.probe.suspended++;if(!window.allow)throw pending;return null;}
function App(){const [visit,setVisit]=React.useState(0),[epoch,setEpoch]=React.useState(0);const owner=visit===1?'Bob':'Alice',transport=transports[owner];let panel;
 if(kind.startsWith('direct'))panel=<LiveRaceDirectInvite transport={transport} challengeId={id}/>;
 else if(kind.startsWith('safety'))panel=<LiveRaceSafety transport={transport} ticketId={'a'.repeat(64)} onBlocked={()=>window.probe.blocked.push(owner)}/>;
 else if(kind==='inbox')panel=<LiveRaceInbox transport={transport} locale='en' onAccept={input=>window.probe.accepted.push({owner,...input})}/>;
 else panel=<LiveRaceInvitationCard transport={transport} challengeId={id} initialChallenge={kind==='preview-cached'?rows[owner]:undefined} locale='en' onAccept={input=>window.probe.accepted.push({owner,...input})}/>;
 return <><React.Suspense fallback={<p data-loading>Preparing panel</p>}><section data-visit={visit} data-owner={owner} data-epoch={epoch}>{panel}{visit===1?<Pending/>:null}</section></React.Suspense><button data-prepare onClick={()=>React.startTransition(()=>setVisit(1))}>Prepare replacement</button><button data-abandon onClick={()=>{setVisit(0);window.allow=true;unblock();}}>Abandon replacement</button><button data-commit onClick={()=>{window.allow=true;unblock();}}>Commit replacement</button><button data-release onClick={()=>window.release()}>Release authority receipts</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-panel-baseline',enforce:'pre',async load(id){const name=components.find(name=>id.endsWith('/'+name+'.tsx'));if(baseline&&name)return readFile(path.join(baseline,name+'.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PANEL_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.PANEL_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const kind of process.env.PANEL_COMMIT_KINDS?.split(',')??['direct-input','direct-pending','direct-confirmed','safety-category','safety-pending','safety-confirmed','inbox','preview-network','preview-cached'])for(const change of process.env.PANEL_COMMIT_CHANGES?.split(',')??['abandon','commit','stable']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,kind,change,name,actual,expected}),direct=kind.startsWith('direct'),safety=kind.startsWith('safety'),readOnly=!direct&&!safety;
  await page.goto(url+'/?kind='+kind);const selector=direct?'.live-race-direct-invite input':safety?'.live-race-safety select':'.live-race-invitation';
  if(readOnly)await page.locator('.live-race-invitation h2').waitFor();else if(safety){await page.locator('.live-race-safety summary').click();await page.locator('select').selectOption('spam');}else await page.locator(selector).fill('Rival');
  if(kind.endsWith('pending')||kind.endsWith('confirmed')){await page.locator(direct?'.live-race-direct-invite > button':kind==='safety-pending'?'.live-race-report':'.live-race-block').click();await page.waitForFunction(()=>window.probe.calls.length===1);if(kind.endsWith('confirmed')){await page.locator('[data-release]').click();await page.getByRole('status').waitFor();}}
  await page.evaluate(selector=>{window.beforeNode=document.querySelector(selector);window.beforeReads=window.probe.reads.length;window.holdReads=true;},selector);
  if(change==='stable'){for(let i=0;i<8;i++)await page.locator('[data-parent]').click();}
  else{await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('prepared replacement leaves the original visible owner',await page.locator('[data-owner]').getAttribute('data-owner'),'Alice');await page.locator(change==='abandon'?'[data-abandon]':'[data-commit]').click();await page.waitForFunction(v=>document.querySelector('[data-visit]')?.dataset.visit===v,change==='abandon'?'0':'1');if(change==='abandon')await page.locator('[data-parent]').click();}
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  metric('panel identity follows only committed ownership changes',await page.evaluate(selector=>window.beforeNode===document.querySelector(selector),selector),change!=='commit');
  if(change!=='commit'){
   metric('abandoned and ordinary updates do not issue another server read',await page.evaluate(()=>window.probe.reads.length-window.beforeReads),0);
   if(direct){metric('selected recipient remains intact',await page.locator(selector).inputValue(),'Rival');metric('pending or confirmed selection remains excluded',await page.locator(selector).isDisabled(),kind!=='direct-input');}
   if(safety){metric('selected report reason remains intact',await page.locator(selector).inputValue(),'spam');metric('confirmed block remains excluded',await page.locator('.live-race-block').isDisabled(),kind!=='safety-category');}
   if(readOnly){metric('loaded invitations stay available without another receipt',await page.locator('.live-race-invitation h2').count(),1);if(await page.locator('.live-race-invitation button').count())await page.locator('.live-race-invitation button').click();metric('explicit acceptance stays with its visible provider',await page.evaluate(()=>window.probe.accepted.map(x=>x.owner)),['Alice']);}
   if(kind.endsWith('pending')||kind.endsWith('confirmed')){await page.locator('[data-release]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));metric('owned authority confirmation survives an abandoned or ordinary update',await page.getByRole('status').count(),1);metric('owned mutation is not dispatched twice',await page.evaluate(()=>window.probe.calls.length),1);if(kind==='safety-confirmed')metric('confirmed parent effect remains once',await page.evaluate(()=>window.probe.blocked),['Alice']);}
  }else{
   if(direct){metric('committed provider starts with a fresh recipient',await page.locator(selector).inputValue(),'');metric('new provider can select its own recipient',await page.locator(selector).isEnabled(),true);await page.locator(selector).fill('Next rival');await page.locator('.live-race-direct-invite > button').click();metric('new recipient dispatch uses only the committed provider',await page.evaluate(()=>window.probe.calls.at(-1)?.owner),'Bob');}
   if(safety){await page.locator('.live-race-safety summary').click();metric('committed provider starts with a fresh reason',await page.locator(selector).inputValue(),'harassment');metric('committed provider owns independent block admission',await page.locator('.live-race-block').isEnabled(),true);await page.locator('.live-race-report').click();metric('new report dispatch uses only the committed provider',await page.evaluate(()=>window.probe.calls.at(-1)?.owner),'Bob');}
   await page.locator('[data-release]').click();if(readOnly){await page.locator('.live-race-invitation h2').waitFor();metric('committed replacement receives only its own preview',await page.locator('.live-race-invitation h2').textContent(),'Bob challenged you');await page.locator('.live-race-invitation button').click();metric('replacement acceptance belongs to the new provider',await page.evaluate(()=>window.probe.accepted.map(x=>x.owner)),['Bob']);}else{await page.getByRole('status').waitFor();metric('old receipt cannot overwrite the replacement confirmation',await page.getByRole('status').count(),1);}
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,kind,change].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.PANEL_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.PANEL_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live panels retain committed lifetimes');
