import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(root, "artifacts/rank-avatar-frames/35-ranks");
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/rank-avatars-"));
const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.race-lobby.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.modal-shell.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.account.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.profile-details.css"))};
import {ProfileModalPage} from ${JSON.stringify(path.join(root, "src/web/play/modalPages/profile/ProfileModalPage.tsx"))};
import {LeaderboardModalPage} from ${JSON.stringify(path.join(root, "src/web/play/modalPages/leaderboard/LeaderboardModalPage.tsx"))};
import {RaceInboxPanel} from ${JSON.stringify(path.join(root, "src/web/play/race/components/RaceLobbyPanels.tsx"))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root, "src/web/play/race/LiveRaceGame.tsx"))};
import {RankedAvatar} from ${JSON.stringify(path.join(root, "src/web/play/RankedAvatar.tsx"))};
import {RankIcon} from ${JSON.stringify(path.join(root, "src/web/play/RankIcon.tsx"))};
import {RanksModalPage} from ${JSON.stringify(path.join(root, "src/web/play/modalPages/profile/ProfileStatsModalPages.tsx"))};
import {tr} from ${JSON.stringify(path.join(root, "src/web/play/i18n.ts"))};
import {PLAYER_RANKS, RANK_MATERIAL_ORDER} from ${JSON.stringify(path.join(root, "src/web/play/ranks.ts"))};
const mode = new URLSearchParams(location.search).get('mode');
const noop = () => {};
const portrait = '/portrait.svg';
const entries = PLAYER_RANKS.map((rank, index) => ({userId:'user-'+index, username:rank.id, level:rank.minimumLevel, avatarUrl:index%2 ? portrait : null, xp:1000-index, totalWins:index, bestStreak:index}));
const now = Date.now();
const view = {ticketId:'a'.repeat(64),phase:'countdown',serverNowMs:now,searchEndsAtMs:now+600000,startsAtMs:now+600000,
 player:{displayName:'Nova',avatarUrl:new URL(portrait,location.href).href,level:36,bot:false,correctCount:0},
 opponent:{displayName:'Rival',avatarUrl:new URL(portrait,location.href).href,level:10,bot:false,correctCount:0},run:null,result:null,rewardCoins:0};
window.setLiveRank = level => {view.player.level = level;};
const transport = {join:async()=>view,update:async()=>view};
function App() {
 const [level,setLevel] = useState(1), [avatarUrl,setAvatar] = useState(portrait);
 window.setRank = setLevel; window.setPortrait = setAvatar;
 const profile = {userId:'user',username:'Nova',avatarUrl,level,xp:0,coins:100,achievements:[],stats:{},wins:0,totalWins:0,bestStreak:0,dailyPuzzlesCompleted:0};
 if(mode==='ranks') return <div className='game-modal modal-ranks' style={{position:'relative',transform:'none',inset:'auto',margin:'20px auto'}}><RanksModalPage profile={profile}/></div>;
 if(mode==='gallery') return <div style={{padding:28,background:'#231e2a',color:'white',display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:24}}>{RANK_MATERIAL_ORDER.map(material => {
   const ranks = PLAYER_RANKS.filter(rank => rank.material === material);
   return <section key={material}><h2 style={{color:ranks[0].glowColor,margin:'0 0 20px'}}>{tr(ranks[0].materialKey)}</h2>{ranks.map(rank=><div key={rank.id} style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><RankedAvatar avatarUrl={portrait} level={rank.minimumLevel} size={72} fallback='N'/><div><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{color:rank.glowColor}}><RankIcon name={rank.icon}/></span><b style={{fontSize:13}}>{tr(rank.nameKey)}</b></div><small style={{color:'#bfb6c8'}}>{tr('Ranks.LEVEL_REQUIREMENT_PREFIX')}{rank.minimumLevel}</small></div></div>)}</section>;
 })}</div>;
 if(mode==='live') return <LiveRaceGame transport={transport} locale='en' categoryId='mixed' coins={100} onClose={noop}/>;
 if(mode==='inbox') return <RaceInboxPanel items={entries.map((entry,index)=>({itemId:'item-'+index,challengeId:'challenge-'+index,opponentUserId:entry.userId,opponentDisplayName:entry.username,opponentAvatarUrl:entry.avatarUrl,opponentLevel:entry.level,categoryId:'mixed',result:'win',adjustedDeltaMs:100,read:false,createdAtMs:now}))} loading={false} safetyPending={null} onRematch={noop} onBlock={noop} onReport={noop} onChooseCategory={noop}/>;
 if(mode==='leaderboard') return <div className='game-modal modal-leaderboard' style={{position:'relative',transform:'none',inset:'auto',margin:'20px auto'}}><LeaderboardModalPage entries={entries} loading={false} leaderboardType='xp' onRequestLeaderboard={noop}/></div>;
 return <div className='game-modal modal-profile' style={{position:'relative',transform:'none',inset:'auto',margin:'20px auto'}}><ProfileModalPage profile={profile} platformRegistered onOpenModal={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop}/></div>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#faf5e9"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
const ranks = [[1, "stargazer"], [2, "emberSeeker"], [3, "pathfinder"], [4, "clueKeeper"], [5, "runeReader"], [6, "riddleScout"], [7, "trailWarden"], [8, "puzzleAdept"], [9, "bronzeSentinel"], [10, "cipherKnight"], [11, "wordsmith"], [12, "scrollScholar"], [13, "codeBreaker"], [14, "silverRanger"], [15, "oracle"], [16, "patternWeaver"], [17, "labyrinthGuide"], [18, "silverGuardian"], [19, "goldenSeeker"], [20, "loreMaster"], [21, "luminary"], [22, "riddleChampion"], [23, "cipherSage"], [24, "starForger"], [25, "goldenSovereign"], [26, "dawnHerald"], [27, "sunKeeper"], [28, "astralSage"], [29, "mithrilWarden"], [30, "voidWalker"], [31, "celestialSeer"], [32, "runeSovereign"], [33, "infinitySage"], [34, "mythicArchitect"], [35, "questLegend"]];
const expectedMaterial = level => level < 10 ? "bronze" : level < 19 ? "silver" : level < 28 ? "gold" : "mithril";
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,"public"),logLevel:"error",build:{outDir:"dist"}});
 server = createServer(async (request,response) => {
  const url = new URL(request.url,"http://localhost");
  if(url.pathname==='/portrait.svg') {response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#efe0ce"/><circle cx="50" cy="39" r="20" fill="#7857a5"/><ellipse cx="50" cy="93" rx="34" ry="30" fill="#7857a5"/></svg>');return;}
  try {const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.woff2')?'font/woff2':'text/html');response.end(await readFile(file));} catch {response.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const geometries=new Set(), symbols=new Set();
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]) {
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  for(const [level,rank] of ranks) {
   await page.evaluate(level=>window.setRank(level),level);
   await page.locator(`.profile-avatar-button [data-avatar-rank="${rank}"]`).waitFor();
   const avatar=page.locator('.profile-avatar-button .ranked-avatar');
   assert.equal(await avatar.getAttribute('data-avatar-rank'),rank);
   geometries.add(await avatar.locator('.ranked-avatar-ornament').getAttribute('d'));
   symbols.add(await avatar.locator('.ranked-avatar-symbol path').getAttribute('d'));
   assert.equal(await avatar.getAttribute('data-avatar-material'),expectedMaterial(level));
   assert.equal(await avatar.locator('[data-rank-icon]').count(),1);
   const bounds=await avatar.boundingBox();assert.equal(bounds.width,84);assert.equal(bounds.height,84);
   assert(!(await avatar.getAttribute('title')).includes('Ranks.'));
  }
  await page.screenshot({path:path.join(output,`profile-${viewport.width}.png`)});
  await page.evaluate(()=>window.setPortrait('/missing.webp'));
  await page.locator('.profile-avatar-button .profile-avatar-fallback').waitFor();
  assert.equal(await page.locator('.profile-avatar-button .ranked-avatar').getAttribute('data-avatar-rank'),'questLegend');
  await page.evaluate(()=>window.setPortrait('/portrait.svg?new'));
  await page.locator('.profile-avatar-button .ranked-avatar-image').waitFor();
  const chooser=page.waitForEvent('filechooser');await page.locator('.profile-avatar-button').click();await chooser;
  for(const mode of ['leaderboard','inbox']) {
   await page.goto(`${origin}/?mode=${mode}`);
   await page.locator('.ranked-avatar').first().waitFor();
   const seen = [];
   for(let pagination = 0; pagination < (mode === 'leaderboard' ? 4 : 1); pagination++) {
    seen.push(...await page.locator('.ranked-avatar').evaluateAll(nodes=>nodes.map(node=>node.dataset.avatarRank)));
    const size=mode==='leaderboard'?30:48;
    for(const box of await page.locator('.ranked-avatar').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}))))assert.deepEqual(box,{width:size,height:size});
    await page.screenshot({path:path.join(output,`${mode}-${viewport.width}-${pagination}.png`)});
    if(mode==='leaderboard' && pagination<3) await page.getByRole('button',{name:'Next'}).click();
   }
   assert.deepEqual(seen,ranks.map(([,rank])=>rank));
  }
  await page.goto(`${origin}/?mode=ranks`);
  await page.locator('.rank-list article').first().waitFor();
  assert.deepEqual(await page.locator('.rank-list article').evaluateAll(nodes=>nodes.map(node=>node.dataset.rankId)),ranks.map(([,rank])=>rank));
  assert.deepEqual(await page.locator('.rank-material-section').evaluateAll(nodes=>nodes.map(node=>node.dataset.rankMaterial)),['bronze','silver','gold','mithril']);
  assert.equal(await page.locator('.rank-list article [data-rank-icon]').count(),35);
  assert.equal(await page.locator('.rank-list article[aria-current="step"]').count(),1);
  await page.locator('.rank-list article').last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.rank-list article .ranked-avatar')).at(-1).checkVisibility({contentVisibilityAuto:true}));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(output,`rank-catalogue-${viewport.width}.png`)});
  await page.goto(`${origin}/?mode=live`);
  await page.locator('.live-race-self [data-avatar-rank="questLegend"]').waitFor();
  await page.locator('.live-race-rival [data-avatar-rank="cipherKnight"]').waitFor();
  await page.screenshot({path:path.join(output,`live-${viewport.width}.png`)});
  for(const level of [1,10,19,28,35]) {
   await page.evaluate(level=>window.setLiveRank(level),level);
   await page.locator(`.live-race-self [data-avatar-rank="${ranks[level-1][1]}"]`).waitFor();
   assert.equal(await page.locator('.live-race-self .ranked-avatar').getAttribute('data-avatar-material'),expectedMaterial(level));
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 assert.equal(geometries.size,35,'Each rank must have distinct frame geometry');
 assert.equal(symbols.size,35,'Each rank must have a distinct custom symbol');
 const page=await browser.newPage({viewport:{width:1360,height:1000}});await page.goto(`${origin}/?mode=gallery`);await page.locator('.ranked-avatar').first().waitFor();await page.screenshot({path:path.join(output,'all-ranks.png'),fullPage:true});await page.close();
 console.log('Verified 35 custom frames and symbols in four material tiers; all profiles, paginated leaderboards, result inboxes and rank catalogue at mobile/desktop sizes; all live material transitions, image fallback/recovery and upload remain functional.');
} finally {await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());await rm(scratch,{recursive:true,force:true});}
