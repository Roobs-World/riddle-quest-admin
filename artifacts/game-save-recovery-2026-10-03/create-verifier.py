from pathlib import Path
p=Path('packages/portal/scripts/verify-jest-state-queue-browser.mjs').read_text();head=p[:p.index(' for(const width')]
head=head.replace('JEST_QUEUE','SAVE_RECOVERY').replace('jest-state-queue-2026-10-03','game-save-recovery-2026-10-03').replace('jest-queue-','save-recovery-').replace("['/useJestPlayerStateWrites.ts','/commitJestStartupSession.ts']","['/useJestPlayerStateWrites.ts']")
head=head.replace('applyPlayerPreferences} from','applyPlayerPreferences,setPlayerHighContrast,setPlayerReducedMotion} from')
a=head.index('window.storageProbe=');b=head.index('const platform=new JestSdkPlatform',a)
head=head[:a]+'''window.storageProbe={writes:[],preferenceWrites:[],flushes:0,failures:[],initializations:0,failDraft:0,failPreferences:0,failClear:0};let release,released=false,lastOperation,releaseNext;const heldFlush=new Promise(r=>release=r);let holdNext=false;
let player={playerId:'jest-player',registered:new URL(location.href).searchParams.has('registered')};const stores=new Map(),durable=new Map();
const getStore=()=>{if(!stores.has(player.playerId))stores.set(player.playerId,{});return stores.get(player.playerId);};
window.durableData=()=>structuredClone(durable.get(player.playerId)??{});window.seedSdkPreference=(key,value)=>{getStore()[key]=value;durable.set(player.playerId,{...(durable.get(player.playerId)??{}),[key]:value});};window.holdNextDraft=()=>holdNext=true;window.releaseNextDraft=()=>releaseNext?.();
const sdk={init:async()=>{window.storageProbe.initializations++;},getPlayer:()=>player,data:{
set:(key,value)=>{const kind=typeof key==='string'?'state':'preferences',data=structuredClone(typeof key==='string'?value:key);if(kind==='state')getStore()[key]=data;else Object.assign(getStore(),data);lastOperation={kind,playerId:player.playerId,value:data,ack:false};window.storageProbe[kind==='state'?'writes':'preferenceWrites'].push(lastOperation);},
getAll:()=>structuredClone(getStore()),delete:key=>delete getStore()[key],flush:async()=>{window.storageProbe.flushes++;const entry=lastOperation;if(!released)await heldFlush;const draft=entry.kind==='state'&&entry.value.activeGame?.currentLetters.join('')==='PIAN';const clear=entry.kind==='state'&&entry.value.activeGame===null;
if((draft&&window.storageProbe.failDraft>0)||(clear&&window.storageProbe.failClear>0)||(entry.kind==='preferences'&&entry.value.highContrast===true&&window.storageProbe.failPreferences>0)){if(draft)window.storageProbe.failDraft--;else if(clear)window.storageProbe.failClear--;else window.storageProbe.failPreferences--;entry.failed=true;throw new Error('injected SDK flush failure');}
if(holdNext&&entry.kind==='state'&&entry.value.activeGame){holdNext=false;await new Promise(r=>releaseNext=r);}const prior=durable.get(entry.playerId)??{};durable.set(entry.playerId,entry.kind==='state'?{...prior,riddleQuestPlayerState:entry.value}:{...prior,...entry.value});entry.ack=true;}}};
'''+head[b:]
head=head.replace('window.mergeProfile=()', 'window.changePreferences=()=>{setPlayerHighContrast(true);setPlayerReducedMotion(false);};\nwindow.mergeProfile=()')
Path('packages/portal/scripts/verify-game-save-recovery-browser.mjs').write_text(head+''' for(const width of [390,1280])for(const registered of [false,true])for(const scenario of ['automatic','online','visibility','preferences','disable','other-player','clear','exhausted','healthy-inflight']) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,registered,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+(registered?'?registered=1':''));await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  metric('native input remains playable',await page.evaluate(()=>window.draft()),'PIAN');
  metric('SDK initialized',await page.evaluate(()=>window.storageProbe.initializations>0),true);
  await page.clock.install();
  if(scenario==='online')await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));
  if(scenario==='visibility')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.evaluate(scenario=>{if(!['preferences','clear'].includes(scenario))window.storageProbe.failDraft=scenario==='exhausted'?100:1;window.releaseStorage();},scenario);await page.evaluate(()=>window.awaitQueue());
  const draftWrites=()=>page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame?.currentLetters.join('')==='PIAN').length);
  if(['automatic','online','visibility','exhausted','disable','other-player','healthy-inflight'].includes(scenario)) {
   metric('failed draft remains unacknowledged',await page.evaluate(()=>window.storageProbe.writes.find(x=>x.failed)?.ack),false);
   metric('one initial failure report',await page.evaluate(()=>window.storageProbe.failures.filter(x=>x==='player_data_save_failed').length),1);
  }
  if(scenario==='automatic') {
   await page.clock.runFor(1001);await page.evaluate(()=>window.awaitQueue());
   metric('one automatic retry without another edit',await draftWrites(),2);
   metric('retry makes newest draft durable',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(['online','visibility'].includes(scenario)) {
   await page.clock.runFor(20000);metric('unavailable browser does not poll saves',await draftWrites(),1);
   await page.evaluate(scenario=>{if(scenario==='online'){Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));}else{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));}},scenario);
   await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('real recovery signal retries pending draft',await draftWrites(),2);
   metric('resume makes draft durable',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(scenario==='preferences') {
   await page.evaluate(()=>{window.seedSdkPreference("locale","fr");window.storageProbe.failPreferences=2;window.changePreferences();});await page.evaluate(()=>window.awaitQueue());
   metric('two rejected preference flushes',await page.evaluate(()=>window.storageProbe.failures.filter(x=>x==='preference_save_failed').length),2);
   await page.clock.runFor(1001);await page.evaluate(()=>window.awaitQueue());
   metric('unrelated SDK preference metadata survives recovery',await page.evaluate(()=>window.durableData().locale),'fr');
   metric('merged preference fields retry together',await page.evaluate(()=>({highContrast:window.durableData().highContrast??false,reducedMotion:window.durableData().reducedMotion??true})),{highContrast:true,reducedMotion:false});
  } else if(scenario==='disable') {
   await page.evaluate(()=>window.writes.disable());await page.clock.runFor(60000);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(20);
   metric('disabled session never retries',await draftWrites(),1);
  } else if(scenario==='other-player') {
   await page.evaluate(()=>window.restart(true));await page.locator('[data-host-epoch="1"]').waitFor();await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();await page.clock.runFor(7001);await page.evaluate(()=>window.awaitQueue());
   metric('replacement player never imports old draft',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.playerId==='other-player').every(x=>!x.value.activeGame)),true);
   metric('replacement retains authority profile',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.profile.coins),80);
  } else if(scenario==='clear') {
   metric('prior draft is durable before completion',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIAN');
   await page.evaluate(()=>window.storageProbe.failClear=100);await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&window.latestCheckpoint()===null);await page.evaluate(()=>window.awaitQueue());
   await page.clock.runFor(8001);await page.evaluate(()=>window.awaitQueue());
   metric('failed completion clear remains unacknowledged',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame!=null),true);
   await page.evaluate(()=>{window.storageProbe.failClear=0;window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('completion clear retries without replaying authority',await page.evaluate(()=>({clear:window.durableData().riddleQuestPlayerState.activeGame,guesses:window.probe.guesses,completions:window.probe.completions})),{clear:null,guesses:1,completions:1});
  } else if(scenario==='exhausted') {
   await page.clock.runFor(7001);await page.evaluate(()=>window.awaitQueue());metric('three automatic retries bound persistent failure',await draftWrites(),4);
   await page.clock.runFor(60000);metric('exhausted retries leave no ongoing polling',await draftWrites(),4);
   await page.evaluate(()=>{window.storageProbe.failDraft=0;window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('reconnection can recover after automatic budget expires',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(scenario==='healthy-inflight') {
   await page.evaluate(()=>window.holdNextDraft());await page.keyboard.type('o');await page.waitForFunction(()=>window.storageProbe.writes.some(x=>x.value.activeGame?.currentLetters.join('')==='PIANO'));
   await page.clock.runFor(1001);metric('retry waits behind a healthy entered save',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame).length),2);
   await page.evaluate(()=>window.releaseNextDraft());await page.evaluate(()=>window.awaitQueue());await page.clock.runFor(60000);
   metric('healthy acknowledgement cancels redundant retries',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame).length),2);
   metric('healthy newest answer reaches durable SDK data',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIANO');
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${registered?'registered':'guest'}-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
''')
