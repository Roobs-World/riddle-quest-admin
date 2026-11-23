import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, writeFile, rm, symlink} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const root = path.resolve(process.env.LIVE_SEARCH_CLOSE_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
const require = createRequire(path.join(root, "package.json"));
const {build} = await import(require.resolve("vite"));
const {chromium} = require("@playwright/test");
const mode = process.env.LIVE_SEARCH_CLOSE_MODE ?? "production";
const output = path.resolve(process.env.LIVE_SEARCH_CLOSE_REPORT_DIR ?? path.join(root, "builds/test-evidence/live-search-close", mode));
await mkdir(output, {recursive: true});
const scratch = await mkdtemp("/tmp/live-search-close-");
await symlink(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "dir");
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/races/components/recorded/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/races/testing/browser/fakeRaceServices.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, "src/settings/browser/playerPreferences.ts"))};
import {LiveRaceViewSchema, RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
applyPlayerPreferences({locale:'en', muted:true, reducedMotion:true, onboardingComplete:true});
const scenario = new URLSearchParams(location.search).get('scenario');
window.probe = {joins:[], retirements:[], updates:[], grants:[], errors:[], shares:[], outerCloses:0};
window.addEventListener('error', e => window.probe.errors.push(String(e.error ?? e.message)));
window.addEventListener('unhandledrejection', e => window.probe.errors.push(String(e.reason)));
const intents = new Map(), tickets = new Map();
let activeJoin;
function snapshot(record) {
  const now = Date.now(), start = now - 1000;
  const searching = !record.paired;
  return LiveRaceViewSchema.parse({ticketId:record.ticketId,
    ...(record.private ? {challengeId:'live_'+record.ticketId} : {waitForPlayer:true}),
    phase:record.left?'cancelled':searching?'searching':'racing',
    serverNowMs:now, searchEndsAtMs:now+60000, startsAtMs:searching?null:start,
    player:{displayName:'Owner', avatarUrl:null, bot:false, correctCount:record.correct},
    opponent:searching?null:{displayName:'Fixture Rival', avatarUrl:null, bot:false, correctCount:0},
    result:null, rewardCoins:0, run:searching||record.left?null:{runId:record.ticketId, role:'creator', status:'active',
      categoryId:'mixed', locale:'en', rules:RACE_RULES, correctCount:record.correct, wallElapsedMs:now-start,
      totalPenaltyMs:0, adjustedElapsedMs:now-start, events:[], serverNowMs:now, startsAtMs:start,
      currentRiddle:{riddleId:'q'+record.correct, text:'What has keys but cannot open doors?', answerLength:5,
        position:record.correct, guessesUsed:0, guessesRemaining:5, hintAvailable:true,
        revealedLetters:[], confirmedGuesses:[]}}});
}
const transport = {
  async join(input) {
    window.probe.joins.push(input);
    if (intents.get(input.requestId)?.retired) throw Object.assign(new Error('Retired'), {code:'functions/failed-precondition'});
    const old = intents.get(activeJoin);
    if (old && !old.left && old.private !== Boolean(input.createChallenge))
      throw Object.assign(new Error('Finish the current live race first.'), {code:'functions/failed-precondition'});
    const index=window.probe.joins.length;
    const record={ticketId:(index===1?'a':'b').repeat(64), private:Boolean(input.createChallenge), correct:0, left:false, retired:false, paired:index>1&&!input.createChallenge};
    intents.set(input.requestId,record); tickets.set(record.ticketId,record); activeJoin=input.requestId;
    const value=snapshot(record);
    if ((scenario==='pending-join'||scenario==='cold-private')&&index===1)
      return new Promise(resolve=>window.releaseJoin=()=>resolve(value));
    return value;
  },
  async retireJoin(input) {
    window.probe.retirements.push(input);
    const attempt=window.probe.retirements.length;
    if (scenario==='retry-retirement'&&attempt===1)
      throw Object.assign(new Error('Temporary outage'),{code:'functions/unavailable'});
    if (scenario==='terminal-retirement'&&attempt===1)
      throw Object.assign(new Error('Authority rejected cleanup'),{code:'functions/permission-denied'});
    if (scenario==='pending-retirement'||scenario==='pending-join'||scenario==='retry-retirement'&&attempt===2)
      await new Promise(resolve=>window.releaseRetirement=resolve);
    const record=intents.get(input.requestId);
    if (record) {record.retired=true;record.left=true;}
    if(activeJoin!==input.requestId)return {status:'superseded'};
    activeJoin=undefined;return {status:'retired'};
  },
  async challenge({challengeId}) {
    const record=tickets.get(challengeId.slice(5));
    return {challengeId,creator:{displayName:'Owner',avatarUrl:null,bot:false,correctCount:0},locale:'en',categoryId:'mixed',expiresAtMs:Date.now()+60000,status:record?.left?'unavailable':'own'};
  },
  async shareChallenge(input) {window.probe.shares.push(input);return 'cancelled';},
  async update(input) {
    window.probe.updates.push(input);
    if(input.action==='leave')throw new Error('Modern cleanup must use the original join, never a replacement ticket');
    const record=tickets.get(input.ticketId);
    if(input.action==='guess') {
      if(record.left)throw new Error('Retired replacement');
      if(input.guess.toLowerCase()!=='piano')throw new Error('Unexpected answer');
      record.correct++;
    }
    return snapshot(record);
  }
};
const catalog=await createFakeRaceServices().listRaceCategories({locale:'en'});
window.authority=()=>({activeJoin,records:[...intents].map(([requestId,record])=>({requestId,...record}))});
window.pairReplacement=()=>{intents.get(activeJoin).paired=true;window.dispatchEvent(new Event('online'));};
createRoot(document.querySelector('#root')).render(<React.StrictMode>
  <RaceTo10Game locale='en' ownerId='original-owner' coins={100} initialCategories={catalog.categories}
    postToHost={()=>{}} matchmaking={{live:transport}} onLiveResult={value=>window.probe.grants.push(value)}
    onClose={()=>window.probe.outerCloses++}/>
</React.StrictMode>);
`;
await writeFile(path.join(scratch,"main.tsx"),source);
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser,server;
const observations=[];
async function silentPage(viewport) {
  const context=await browser.newContext({viewport});
  await context.route('**/*',route=>route.request().resourceType()==='media'||/\.(mp3|mp4|m4a|ogg|wav|webm)(\?|$)/i.test(route.request().url())?route.abort():route.continue());
  await context.addInitScript(()=>{
    Object.defineProperty(HTMLMediaElement.prototype,'play',{configurable:true,value:function(){this.muted=true;this.volume=0;return Promise.resolve();}});
    const OriginalAudio=window.Audio;
    window.Audio=function(...args){const audio=new OriginalAudio(...args);audio.muted=true;audio.volume=0;return audio;};
  });
  return {context,page:await context.newPage()};
}
try {
  await build({root:scratch,configFile:false,cacheDir:path.join(scratch,'.vite'),publicDir:path.join(root,"public"),logLevel:"error",
    define:{"process.env.NODE_ENV":JSON.stringify(mode)},
    plugins:process.env.LIVE_SEARCH_CLOSE_BASELINE?[{name:'retirement-baseline',enforce:'pre',async load(id){if(id.endsWith('/LiveRaceGame.tsx'))return readFile(process.env.LIVE_SEARCH_CLOSE_BASELINE,'utf8');}}]:[],
    build:{outDir:"dist",target:"esnext"}});
  server=createServer(async(req,res)=>{
    try {const name=new URL(req.url,"http://localhost").pathname,file=path.join(scratch,"dist",name==='/'?'index.html':name);
      res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]??'text/html');res.end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,args:['--mute-audio']});
  const url=`http://127.0.0.1:${server.address().port}`;
  const widths=process.env.LIVE_SEARCH_CLOSE_WIDTHS?.split(',').map(Number)??[390,1280];
  const scenarios=process.env.LIVE_SEARCH_CLOSE_SCENARIOS?.split(',')??['pending-join','searching','pending-retirement','retry-retirement','terminal-retirement'];
  const directions=process.env.LIVE_SEARCH_CLOSE_DIRECTIONS?.split(',')??['public-friend','friend-public'];
  const methods=process.env.LIVE_SEARCH_CLOSE_METHODS?.split(',')??['click','escape'];
  for(const width of widths)for(const scenario of scenarios)for(const direction of directions)for(const method of methods){
    const row={width,height:844,scenario,direction,method,passed:false};observations.push(row);
    const {context,page}=await silentPage({width,height:844});
    try {
      await page.goto(`${url}/?scenario=${scenario}`);
      const start=page.getByRole('button',{name:'Start PvP match',exact:true});
      const challenge=page.getByRole('button',{name:'Challenge a friend',exact:true});
      await (direction==='public-friend'?start:challenge).click();
      await page.waitForFunction(()=>window.probe.joins.length===1);
      if(scenario==='pending-join')await page.waitForFunction(()=>Boolean(window.releaseJoin));
      else await page.waitForFunction(()=>Boolean(document.querySelector('.live-race-self strong,.friend-lobby-seat[data-occupied="true"]')));
      if(method==='click')await page.locator('.race-close').click();else await page.keyboard.press('Escape');
      if(['pending-join','pending-retirement','retry-retirement'].includes(scenario)){
        await page.waitForFunction(()=>Boolean(window.releaseRetirement));
        assert.equal(await start.isVisible(),false,'A new lobby cannot open before retirement confirmation');
        assert.equal(await page.getByText('Quitting…',{exact:true}).isVisible(),true,'Close shows its pending status');
        assert.equal(await page.locator('.race-error').count(),0,'An in-progress close is not a race failure');
        assert.equal(await page.locator('.friend-lobby-actions button').count(),0,'Closing cannot send a new friend invitation');
        await page.evaluate(()=>window.releaseRetirement());
      }else if(scenario==='terminal-retirement'){
        await page.locator('.race-error').waitFor();
        assert.equal(await start.isVisible(),false,'Rejected retirement cannot expose a new lobby');
        await page.getByRole('button',{name:'Retry',exact:true}).click();
      }
      await start.waitFor({timeout:5000});
      await (direction==='public-friend'?challenge:start).click();
      await page.waitForFunction(()=>window.probe.joins.length===2);
      if(direction==='public-friend'){
        await page.locator('.friend-lobby[data-state="waiting"] .friend-lobby-count').waitFor();
        assert.equal(await challenge.isVisible(),true,'The first friend entry opens its invitation controls');
        assert.equal(await page.locator('.race-error').count(),0,'The first friend entry has no race failure');
        await page.evaluate(()=>window.pairReplacement());
      }
      await page.locator('.race-native-answer-input').waitFor({timeout:5000});
      await page.evaluate(()=>window.releaseJoin?.());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const probe=await page.evaluate(()=>window.probe);
      assert.equal(new Set(probe.joins.map(join=>join.requestId)).size,2,'A replacement search owns a new join identity');
      assert(probe.joins.every(join=>join.retirementAware&&join.expectedOwnerId==='original-owner'));
      assert.equal(Boolean(probe.joins[0].createChallenge),direction==='friend-public');
      assert.equal(Boolean(probe.joins[1].createChallenge),direction==='public-friend');
      assert(probe.retirements.every(retire=>retire.requestId===probe.joins[0].requestId&&retire.expectedOwnerId==='original-owner'));
      assert.equal(probe.retirements.length,scenario==='retry-retirement'||scenario==='terminal-retirement'?2:1);
      assert.equal(probe.updates.filter(update=>update.action==='leave').length,0,'Late old receipts cannot leave a replacement ticket');
      const authority=await page.evaluate(()=>window.authority());
      assert.equal(authority.activeJoin,probe.joins[1].requestId);
      assert.equal(authority.records[0].left,true);
      assert.equal(authority.records[1].left,false);
      assert.equal(await page.locator('.race-error').count(),0);
      await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');
      await page.waitForFunction(()=>window.authority().records[1].correct===1);
      assert.deepEqual(await page.evaluate(()=>window.probe.grants),[]);
      assert.deepEqual(await page.evaluate(()=>window.probe.errors),[]);
      assert.deepEqual(await page.evaluate(()=>window.probe.shares),[],'No native invitation was sent');
      assert.equal(await page.evaluate(()=>window.probe.outerCloses),0);
      row.passed=true;row.retirements=probe.retirements.length;
      await page.screenshot({path:path.join(output,`${scenario}-${direction}-${method}-${width}.png`)});
    }catch(error){row.error=String(error);row.probe=await page.evaluate(()=>window.probe);await page.screenshot({path:path.join(output,`${scenario}-${direction}-${method}-${width}-failure.png`)});throw error;}
    finally{await context.close();}
  }
  if(process.env.LIVE_SEARCH_CLOSE_SKIP_COLD!=='1')for(const width of widths){
    const row={width,height:844,scenario:'cold-private-16s',passed:false};observations.push(row);
    const {context,page}=await silentPage({width,height:844});
    try {
      await page.clock.install();
      await page.goto(`${url}/?scenario=cold-private`);
      await page.getByRole('button',{name:'Challenge a friend',exact:true}).click();
      await page.waitForFunction(()=>Boolean(window.releaseJoin));
      await page.clock.fastForward(16000);
      assert.equal(await page.locator('.race-error').count(),0,'A healthy16-second cold join must not fail at10seconds');
      assert.equal(await page.locator('.friend-lobby').getAttribute('data-state'),'loading');
      await page.evaluate(()=>window.releaseJoin());
      await page.locator('.friend-lobby[data-state="waiting"] .friend-lobby-count').waitFor();
      assert.equal(await page.getByRole('button',{name:'Challenge a friend',exact:true}).isVisible(),true);
      assert.equal(await page.evaluate(()=>window.probe.joins.length),1,'Cold entry needs no Retry');
      assert.deepEqual(await page.evaluate(()=>window.probe.errors),[]);
      row.passed=true;
      await page.screenshot({path:path.join(output,`cold-private-16s-${width}.png`)});
    }catch(error){row.error=String(error);throw error;}finally{await context.close();}
  }
}finally{
  await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));
  await rm(scratch,{recursive:true,force:true});
  await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,scenarios:observations.length,passed:observations.filter(row=>row.passed).length,failures:observations.filter(row=>!row.passed)},null,2));
