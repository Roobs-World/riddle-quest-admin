import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';const require=createRequire('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/package.json');const {build}=require('vite');
const {chromium,firefox}=require('@playwright/test');

// Supporting regression: real keyboard events through the whole solo game.
const root='/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
const evidence = path.resolve(process.env.GUESS_RECOVERY_REPORT_DIR??path.join(root,'../../artifacts/guess-result-recovery-2026-10-08/permanent',process.env.GUESS_RECOVERY_REACT_MODE??'development'));
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/solo-keyboard-input-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root, 'src/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root, 'src/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/styles.css'))};
const owner='keyboard-owner'; let initialized=false;window.sentGuesses=[];window.reloads=[];
const feedback=[...'izmir'].map((letter,index)=>({letter,status:['yellow','yellow','green','red','red'][index]}));
window.addEventListener('riddle-quest:game-to-host',event=>{
 const message=event.detail;
 if(message.type==='game:submitGuess'){
  window.sentGuesses.push(message);setTimeout(()=>{
   const kind=new URL(location.href).searchParams.get('kind');let broken=feedback.map(cell=>({...cell}));
   if(kind==='short')broken=broken.slice(0,4);if(kind==='bad-cell')broken[2].letter='XX';
   window.replyDelivered=true;
   host({type:'host:operationResult',requestId:message.requestId,payload:{operation:'guess',ok:true,data:{
    feedback:broken,attempts:kind==='bad-counter'?0.5:1,isCorrect:kind==='bad-flag'?'false':false,gameOver:false,canContinue:false}}});
  },50);
 }
 if(message.type==='game:loadRiddle'&&window.replyDelivered){
  window.reloads.push(message);setTimeout(()=>{
   host({type:'host:riddleLoaded',requestId:message.requestId,payload:{riddle:{
    riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',text:'Which city is on the Turkish Aegean coast?',
    answerLength:5,gameMode:'classic',index:1,attemptsUsed:1,hasUsedContinue:false,awaitingContinue:false,
    acceptedGuesses:[{attempt:1,feedback}]}}});window.reloadDelivered=true;
  },50);
 }
});
applyPlayerPreferences({locale:'tr',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:requestHint'){setTimeout(()=>{host({type:'host:operationResult',requestId:event.detail.requestId,payload:{operation:'hint',ok:true,data:{index:0,revealedLetter:'İ',newCoins:545}}});window.hintConfirmed=true;},100);return;}if(event.detail.type!=='game:ready'||initialized)return;
 initialized=true;setTimeout(async()=>{await setLocaleAndWait('tr');
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-fixture',locale:'tr',gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,
 winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',
 text:'Which city is on the Turkish Aegean coast?',answerLength:5,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,...(new URL(location.href).searchParams.get('hint')==='true'?{revealedHints:[{index:0,letter:'İ'}]}:{})}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser, server;const observations=[];
try {
   await build({plugins:[{name:'previous-guess-handler',enforce:'pre',resolveId(source,importer){if(source==='./hintLetter'&&importer?.endsWith('/play/useGameMessageRouter.ts'))return path.join(root,'src/play/hintLetter.ts');},load(id){if(id.endsWith('/play/useGameMessageRouter.ts'))return readFile('/home/craig-beswetherick/Documents/riddle-quest/artifacts/guess-result-recovery-2026-10-08/router.before.ts','utf8');if(id.endsWith('/play/hintLetter.ts'))return readFile('/home/craig-beswetherick/Documents/riddle-quest/artifacts/guess-result-recovery-2026-10-08/cell.before.ts','utf8');}}],root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(process.env.GUESS_RECOVERY_REACT_MODE??'development')},build:{outDir:'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await (process.env.GUESS_RECOVERY_ENGINE==='firefox'?firefox:chromium).launch({headless:true,...(process.env.GUESS_RECOVERY_ENGINE==='firefox'&&process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})});
  for(const width of [390,1280])for(const method of ['physical','virtual'])for(const hint of [false])for(const kind of ['short','bad-cell','bad-counter','bad-flag']){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?hint='+hint+'&kind='+kind);await page.getByRole('heading',{name:'Which city is on the Turkish Aegean coast?',exact:true}).waitFor();await page.evaluate(()=>document.activeElement?.blur());
    const text='izmir';if(method==='physical')await page.keyboard.type(text);else if(method==='shifted-physical')await page.evaluate(text=>{for(const key of text.toLocaleUpperCase('tr'))window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));},text);else for(const letter of text)await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter.toLocaleUpperCase('tr')+'$')}).click();
    const draft=await page.locator('.guess-row').first().textContent();assert.equal(draft.replaceAll(/\s/g,''),'İZMİR');
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.replyDelivered);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const reloads=await page.evaluate(()=>window.reloads);assert.equal(reloads.length,1);
    assert.equal(reloads[0].payload.sessionToken,'keyboard-session-0000000000001');assert.equal(reloads[0].payload.riddleId,'keyboard-riddle');
    await page.waitForFunction(()=>window.reloadDelivered);await page.waitForFunction(()=>document.querySelector('.guess-row')?.querySelectorAll('.green').length===1);
    const authoritativeRow=(await page.locator('.guess-row').first().textContent()).replaceAll(/\s/g,'');assert.equal(authoritativeRow.toLocaleLowerCase('tr'),'izmir');
    const guess=await page.evaluate(()=>window.sentGuesses[0].payload.guess);assert.equal(guess.toLocaleLowerCase('tr'),'izmir');
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('zombi');
    const nextDraft=(await page.locator('.guess-row').nth(1).textContent()).replaceAll(/\s/g,'');assert.equal(nextDraft.toLocaleLowerCase('tr'),'zombi');
    assert.equal(await page.locator('.submit-action').isEnabled(),true);assert.equal(await page.evaluate(()=>window.sentGuesses.length),1);assert.deepEqual(errors,[]);
    observations.push({width,method,kind,authoritativeRow,nextDraft,guess,reloads:reloads.length,browserErrors:errors});await page.close();
  }

} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
