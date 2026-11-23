import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.GUIDANCE_LOCALE_REACT_MODE??'development',baseline=process.env.GUIDANCE_LOCALE_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.GUIDANCE_LOCALE_REPORT_DIR??path.join(root,'builds/test-evidence/guidance-locale-work-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/guidance-locale-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GuidanceOverlay} from ${JSON.stringify(path.join(root,'src/web/play/guidance/GuidanceOverlay.tsx'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/hosted/play/gameSession.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/web/play/guidance/guidanceConfig.ts'))};
import {getCurrentLocale,setLocaleAndWait,tr,useLocale} from ${JSON.stringify(path.join(root,'src/web/play/i18n.ts'))};
import {applyPlayerPreferences,completePlayerOnboarding} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.guidanceKeys={anchored:createTooltipTourStorageKey('gameTour'),centered:createGuidanceStorageKey('tooltipSeen:leaderboardFifthCorrectAnswer')};
const params=new URL(location.href).searchParams,anchored=params.get('scenario')==='anchored';
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});await setLocaleAndWait(params.get('initial')??'en');
completePlayerOnboarding(createGuidanceStorageKey('onboarding'));sessionStorage.setItem(createGuidanceStorageKey('welcomeSession'),'seen');
localStorage.setItem(createGuidanceStorageKey('tooltipSeen:achievementEarned'),'seen');
if(!anchored)localStorage.setItem(createTooltipTourStorageKey('gameTour'),'seen');
window.probe={targetUpdates:0,errors:[],unhandled:[],locale:getCurrentLocale(),expected:null};
window.addEventListener('error',e=>probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>probe.unhandled.push(String(e.reason)));
const riddle={riddleId:'guidance-fixture',sessionToken:'00000000-0000-4000-8000-000000000001',text:'Clue',answerLength:5,gameMode:'classic',attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false};
let state=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user:null,products:[],profile:{username:'Guest',coins:0,level:1,xp:0,winStreak:0,gamesPlayed:5,wins:5,achievements:[],classicIndex:1}});
state=gameSessionReducer(state,{type:'loadRiddle',riddle});
if(!anchored)state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIANO'],feedback:['green','green','green','green','green']},attempts:1,isCorrect:true,gameOver:true,canContinue:false});
const id=anchored?'submitAnswer':'leaderboardFifthCorrectAnswer';
function App(){const locale=useLocale(),[tick,setTick]=React.useState(0),[suspended,setSuspended]=React.useState(false);probe.locale=locale;const [title,body]=TOOLTIP_KEYS[id];probe.expected={title:tr(title),body:tr(body),button:tr('Tooltips.GOT_IT_BUTTON'),id};
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,fontSize:10}}><select data-locale aria-label="Fixture locale" value={locale} onChange={e=>void setLocaleAndWait(e.target.value)}>{['ar','de','en','es','fr','hi','id','it','ja','ko','nl','pl','pt','ru','tr','vi'].map(value=><option key={value}>{value}</option>)}</select><button data-refresh onClick={()=>setTick(x=>x+1)}>Deliver update</button><button data-suspend onClick={()=>setSuspended(x=>!x)}>Suspend</button><span data-tick>{tick}</span></nav><div style={{position:'fixed',left:40,bottom:40,width:300,display:'flex',gap:16}}><button data-tooltip="submitAnswer" style={{width:110,height:30}}>Anchor</button><button style={{width:110,height:30}}>Other control</button></div><GuidanceOverlay state={state} modal={null} suspended={suspended} economyAvailable={false}/></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'guidance-work-probe',enforce:'pre',async load(id){if(!id.endsWith('/GuidanceOverlay.tsx'))return;let source=await readFile(baseline?path.join(baseline,'GuidanceOverlay.before.txt'):id,'utf8');const marker='const updateRect = () => {';assert.equal(source.split(marker).length,2);return source.replace(marker,marker+' window.probe.targetUpdates++;');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.GUIDANCE_LOCALE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.GUIDANCE_LOCALE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of ['centered','anchored'])for(const locale of process.env.GUIDANCE_LOCALE_LOCALES?.split(',')??['ar','de','en','es','fr','hi','id','it','ja','ko','nl','pl','pt','ru','tr','vi']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),initial=locale==='en'?'de':'en';
  const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,locale,name,actual,expected});
  const copy=()=>page.evaluate(()=>({title:document.querySelector('.tooltip-card h2')?.textContent,body:document.querySelector('.tooltip-card p')?.textContent,button:document.querySelector('.tooltip-card button')?.textContent,id:document.querySelector('.tooltip-backdrop')?.getAttribute('data-tooltip-id')}));
  const expected=()=>page.evaluate(()=>probe.expected);
  const updates=()=>page.evaluate(()=>probe.targetUpdates);
  const signal=()=>page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('scroll'));});
  await page.goto(url+'/?scenario='+scenario+'&initial='+initial);await page.locator('.tooltip-card').waitFor();await settle();
  metric('initial translated guidance copy',await copy(),await expected());
  let before=await updates();metric('entry target work is scoped to anchored guidance',scenario==='anchored'?before>0:before===0,true);
  await page.locator('[data-locale]').selectOption(locale);await page.waitForFunction(value=>probe.locale===value,locale);await settle();
  metric('locale subscription committed before checking content',await page.evaluate(()=>document.documentElement.lang),locale);
  const actual=await copy(),want=await expected();metric('live title follows the committed locale',actual.title,want.title);metric('live body follows the committed locale',actual.body,want.body);metric('live action follows the committed locale',actual.button,want.button);metric('locale changes preserve the active step',actual.id,want.id);
  metric('spotlight follows the localized control layout',await page.evaluate(()=>{const highlight=document.querySelector('.tooltip-spotlight');if(!highlight)return probe.expected.id==='leaderboardFifthCorrectAnswer';const target=document.querySelector('[data-tooltip="submitAnswer"]').getBoundingClientRect(),box=highlight.getBoundingClientRect();return Math.abs(box.left-(target.left-6))<1&&Math.abs(box.top-(target.top-6))<1&&Math.abs(box.width-(target.width+12))<1;}),true);
  for(let update=0;update<32;update++)await page.locator('[data-refresh]').click();await settle();
  metric('parent updates preserve the translated step',await copy(),want);
  before=await updates();for(let event=0;event<8;event++)await signal();await settle();let after=await updates();
  metric('viewport signals do work only for an anchored target',scenario==='anchored'?after>before:after===before,true);
  await page.locator('[data-suspend]').click();await page.locator('.tooltip-card').waitFor({state:'detached'});await settle();before=await updates();await signal();await settle();
  metric('suspended guidance performs no target work',await updates(),before);
  await page.locator('[data-locale]').selectOption(initial);await page.waitForFunction(value=>probe.locale===value,initial);await settle();
  await page.locator('[data-suspend]').click();await page.locator('.tooltip-card').waitFor();await settle();metric('resumed guidance follows locale changes while suspended',await copy(),await expected());
  const box=await page.locator('.tooltip-card').boundingBox();metric('translated card and action fit the viewport',box.y>=13&&box.y+box.height<=height-13,true);
  await page.screenshot({path:path.join(output,[scenario,locale,width,height].join('-')+'.png')});
  await page.locator('.tooltip-card button').click();await page.locator('.tooltip-card').waitFor({state:'detached'});await settle();before=await updates();await signal();await settle();
  metric('dismissed guidance performs no target work',await updates(),before);
  metric('completion persists the existing seen marker',await page.evaluate(scenario=>localStorage.getItem(window.guidanceKeys[scenario]),scenario),'seen');
  metric('browser errors',await page.evaluate(()=>probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>probe.unhandled),[]);
  await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));
 if(process.env.GUIDANCE_LOCALE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Guidance live locale and target work');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.GUIDANCE_LOCALE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
