// Supporting compiled UI checks only; hosted Jest verification is recorded separately.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react,{reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=path.resolve(process.env.MATCHMAKING_UI_EVIDENCE??path.join(root,'artifacts/matchmaking-readability'));
await mkdir(evidence,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/matchmaking-ui-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,"src/races/components/live/LiveRaceGame.tsx"))};
import {LIVE_RACE_WAIT_MS,RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import ${JSON.stringify(path.join(root,"src/races/styles/lobby.css"))};
import ${JSON.stringify(path.join(root,"src/races/styles/gameplay.css"))};
const params=new URLSearchParams(location.search),locale=params.get('locale')??'en',mode=params.get('mode')??'racing';
await setLocaleAndWait(locale);window.expectedCopy=key=>tr(key);
const initial=Date.now(),created=initial-LIVE_RACE_WAIT_MS/2,starts=mode==='countdown'?initial+3500:initial-5000;
const long=params.has('long');
const text=locale==='ar'?(long?'أي أداة تستخدم إبرة مغناطيسية وتحتوي على قرص يوضح اتجاهات الشمال والجنوب والشرق والغرب لمساعدة الناس على معرفة الطريق؟':'ما الجزء الصلب من الرأس الذي يحمي الدماغ؟'):(long?'Which navigation tool uses a magnetic needle and a labelled dial to show north, south, east, and west when you need to find your way?':'Which hard part of your head protects your brain?');
const player={displayName:'Test player',avatarUrl:null,bot:false,correctCount:0};
const opponent={displayName:'Test rival',avatarUrl:null,bot:false,correctCount:0};
const snapshot=()=>{const now=Date.now(),phase=mode==='searching'||mode==='private'?'searching':now<starts?'countdown':'racing';
const run=phase==='searching'?null:{runId:'a'.repeat(64),role:'creator',status:phase==='countdown'?'scheduled':'active',serverNowMs:now,startsAtMs:starts,categoryId:'science',locale,rules:RACE_RULES,correctCount:0,wallElapsedMs:Math.max(0,now-starts),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-starts),events:[],currentRiddle:phase==='countdown'?null:{riddleId:'layout-clue',text,answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:opponent.displayName,avatarUrl:null,adjustedFinishMs:300000,events:[]}};
return {ticketId:'a'.repeat(64),phase,serverNowMs:now,searchEndsAtMs:created+(mode==='private'?900000:LIVE_RACE_WAIT_MS),startsAtMs:phase==='searching'?null:starts,player,opponent:phase==='searching'?null:opponent,run,result:null,rewardCoins:0,...(mode==='private'?{challengeId:'live_'+'c'.repeat(64)}:{})};};
const transport={join:async()=>snapshot(),update:async()=>snapshot()};
createRoot(document.getElementById('root')).render(<LiveRaceGame transport={transport} locale={locale} categoryId='science' createChallenge={mode==='private'} coins={100} ownerId='layout-test' onClose={()=>{}}/>);
`);
let browser,server;const cases=[];
try{
 await build({root:scratch,configFile:false,plugins:[react(),babel({presets:[reactCompilerPreset()]})],logLevel:'error',build:{outDir:'dist',target:'esnext'}});
 const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.html':'text/html'};
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 const base='http://127.0.0.1:'+server.address().port;
 for(const locale of ['en','ar'])for(const mode of ['searching','private','countdown']){
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?mode='+mode+'&locale='+locale);
  await page.locator('.friend-lobby').waitFor();
  assert.equal(await page.locator('.friend-lobby-count').count(),0);
  if(mode==='private'||mode==='searching'){
   await page.locator('.friend-lobby-status p').waitFor();
   assert.equal(await page.locator('.live-race-search-wheel').count(),0);
   assert.equal(await page.locator('.friend-lobby-status p').innerText(),await page.evaluate(mode=>window.expectedCopy(mode==='private'?'RaceTo10.LIVE_FRIEND_WAIT':'RaceTo10.LIVE_FINDING'),mode));
   assert.equal(await page.locator('.friend-lobby-play').isDisabled(),true);
   assert.equal(await page.locator('.friend-lobby-play').innerText(),await page.evaluate(()=>window.expectedCopy('RaceTo10.PLAY_GAME')));
   const seats=await page.locator('.friend-lobby-seat').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {y:box.y,right:box.right,width:box.width};}));
   assert.equal(seats.length,2);assert.ok(Math.abs(seats[0].y-seats[1].y)<2,'Both lobby seats share one row');
   assert.ok(seats.every(seat=>seat.width>0&&seat.right<=390),'Both lobby seats fit the viewport');
   await page.screenshot({path:path.join(evidence,locale+'-'+mode+'.png')});
  }else{
   const wheel=page.locator('.live-race-search-wheel');await wheel.waitFor();
   assert.equal(await wheel.innerText(),'');
   assert.equal(await page.locator('.friend-lobby-status p').innerText(),await page.evaluate(()=>window.expectedCopy('RaceTo10.LIVE_STARTING')));
   assert.equal(await page.locator('.friend-lobby-play').getAttribute('aria-busy'),'true');
   assert.equal(await wheel.getAttribute('data-phase'),mode);
   const before=Number(await wheel.getAttribute('aria-valuenow'));
   await page.waitForTimeout(1200);
   const after=Number(await wheel.getAttribute('aria-valuenow'));assert.ok(after>before,'ring must fill as real time passes');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.live-race-search-fill').evaluate(el=>getComputedStyle(el).transitionProperty),'none');
   await page.screenshot({path:path.join(evidence,locale+'-'+mode+'.png')});
  }
  assert.deepEqual(errors,[]);cases.push({locale,mode,numberFree:true});await page.close();
 }
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:424,height:661},{width:1280,height:900}])for(const locale of ['en','ar'])for(const long of [false,true]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?mode=racing&locale='+locale+(long?'&long=1':''));await page.locator('.riddle-card h2').waitFor();await page.evaluate(()=>document.fonts.ready);
  const samples=[];for(let i=0;i<6;i++){await page.waitForTimeout(120);samples.push(await page.locator('.race-gameplay').evaluate(el=>el.getBoundingClientRect().height));}
  assert.ok(Math.max(...samples)-Math.min(...samples)<2,'gameplay must settle without oscillating');
  const layout=await page.evaluate(()=>{const h=document.querySelector('.riddle-card h2'),card=h.closest('.riddle-card'),actions=document.querySelector('.race-actions'),screen=document.querySelector('.race-screen');const rect=h.getBoundingClientRect(),bounds=card.getBoundingClientRect(),scale=rect.width/h.offsetWidth;return {fontPx:parseFloat(getComputedStyle(h).fontSize),effectiveFontPx:parseFloat(getComputedStyle(h).fontSize)*scale,headingFits:h.scrollWidth<=h.clientWidth+1&&rect.bottom<=bounds.bottom+1,actionsBottom:actions.getBoundingClientRect().bottom,screenBottom:screen.getBoundingClientRect().bottom,scale,cardWidth:bounds.width,gameplayWidth:document.querySelector(".race-riddle-surface").getBoundingClientRect().width,titleFontPx:parseFloat(getComputedStyle(screen.querySelector(".race-rail-header h1")).fontSize),clockFontPx:parseFloat(getComputedStyle(screen.querySelector(".race-header-clock strong")).fontSize),scoreFontPx:parseFloat(getComputedStyle(screen.querySelector(".race-progress strong")).fontSize),scoreboardWidth:screen.querySelector(".race-scoreboard").getBoundingClientRect().width,dir:document.documentElement.dir};});
  await page.screenshot({path:path.join(evidence,locale+'-'+viewport.width+'-'+viewport.height+(long?'-long':'')+'.png')});
  const priorClueFont=viewport.width<=620?Math.max(20,Math.min(27,viewport.width*.06)):36;
  assert.ok(Math.abs(layout.fontPx-priorClueFont)<.1,'restore the previously approved clue typography');
  assert.ok(layout.cardWidth<=layout.gameplayWidth+1,'clue card must stay within its original grid area');
  assert.ok(layout.titleFontPx>=16,'multiplayer title must remain readable');assert.ok(layout.clockFontPx>=20,'multiplayer timer must remain readable');assert.ok(layout.scoreFontPx>=12,'multiplayer score must remain readable');assert.ok(layout.headingFits);assert.ok(layout.actionsBottom<=layout.screenBottom+1);
  assert.deepEqual(errors,[]);cases.push({viewport,locale,long,...layout});
  await page.close();
 }
 await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingCompiledUi:true,hostedE2E:false,cases},null,2)+'\n');
 console.log('Matchmaking wheel and balanced multiplayer panel passed '+cases.length+' compiled cases.');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
