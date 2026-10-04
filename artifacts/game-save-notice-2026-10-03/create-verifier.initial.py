from pathlib import Path
p=Path('packages/portal/scripts/verify-game-save-recovery-browser.mjs').read_text();head=p[:p.index(' for(const width')]
head=head.replace('SAVE_RECOVERY','SAVE_NOTICE').replace('game-save-recovery-2026-10-03','game-save-notice-2026-10-03').replace('save-recovery-','save-notice-')
head=head.replace('import {PlayHostApp}', 'import {PlayerSaveRecoveryLayout} from ${JSON.stringify(path.join(root,\'src/play/PlayerSaveRecoveryLayout.tsx\'))};\nimport {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,\'src/play/i18n.ts\'))};\nimport {PlayHostApp}')
head=head.replace("window.__RIDDLE_QUEST_BROWSER_TEST__=true;","window.__RIDDLE_QUEST_BROWSER_TEST__=true;const fixtureLocale=new URL(location.href).searchParams.get('locale')??'en';window.copy=()=>({message:tr('GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE'),retry:tr('CommonButtons.RETRY')});")
head=head.replace("applyPlayerPreferences({locale:'en'", "applyPlayerPreferences({locale:fixtureLocale")
head=head.replace("preferences:{locale:'en'", "preferences:{locale:fixtureLocale")
head=head.replace("void platform.init().then(()=>{if(!active)return;writes.enable", "void platform.init().then(async()=>{await setLocaleAndWait(fixtureLocale);if(!active)return;writes.enable")
head=head.replace('return <div data-host-epoch={epoch}>{ready?<PlayHostApp key={epoch} session={hosted}/>:<p>Initializing fixture SDK</p>}</div>;', 'return <div data-host-epoch={epoch} style={{height:"100%"}}>{ready?<PlayerSaveRecoveryLayout recovery={writes.recovery}><PlayHostApp key={epoch} session={hosted}/></PlayerSaveRecoveryLayout>:<p>Initializing fixture SDK</p>}</div>;')
a=head.index("if(!['/useJestPlayerStateWrites.ts']");b=head.index("}}],build:",a)
head=head[:a]+'''if(id.endsWith('/PlayerSaveRecovery.ts')&&baseline)return (await readFile(path.join(baseline,'PlayerSaveRecovery.before.txt'),'utf8'))+"\\nPlayerSaveRecovery.prototype.getSnapshot=()=> 'quiet';PlayerSaveRecovery.prototype.subscribe=()=>()=>{};";
if(!id.endsWith('/useJestPlayerStateWrites.ts'))return;let code=await readFile(id,'utf8');return code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');'''+head[b:]
# Plugin replacement includes its own return while retaining the original final braces.
head=head.replace("return code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');}}]", "return code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');}}]")
Path('packages/portal/scripts/verify-game-save-notice-browser.mjs').write_text(head+''' const locales=['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi'];
 const cases=locales.flatMap(locale=>(['en','de','ar','ja'].includes(locale)?[280,390,1280]:[390]).map(width=>({locale,width,scenario:'manual'})));
 cases.push(...['transient','preferences','replacement','offline'].map(scenario=>({locale:'en',width:390,scenario})));
 for(const {locale,width,scenario} of cases) {
  const height=width===280?568:844,context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({locale,width,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+'?locale='+locale);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  await page.clock.install();const initializations=await page.evaluate(()=>window.storageProbe.initializations);
  metric('healthy game has no save prompt',await page.locator('.player-save-notice').count(),0);
  if(scenario==='offline')await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));
  await page.evaluate(scenario=>{window.storageProbe.failDraft=scenario==='transient'?1:100;window.releaseStorage();},scenario);await page.evaluate(()=>window.awaitQueue());
  if(scenario==='transient') {
   await page.clock.runFor(1001);await page.evaluate(()=>window.awaitQueue());metric('transient save failures stay quiet',await page.locator('.player-save-notice').count(),0);
   metric('transient recovery persists draft',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIAN');
  } else {
   if(scenario!=='offline')await page.clock.runFor(7001);await page.evaluate(()=>window.awaitQueue());
   if(!baseline)await page.locator('.player-save-notice').waitFor();
   metric('unresolved saves expose recovery',await page.locator('.player-save-notice').count(),1);
   const expected=JSON.parse(await readFile(path.join(root,'../../src/locales',locale,'alerts.json'),'utf8')).GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE;
   metric('prompt uses the actual translated message',await page.locator('.player-save-notice p').count()?await page.locator('.player-save-notice p').innerText():'',expected);
   metric('riddle draft survives visible failure',await page.evaluate(()=>window.draft()),'PIAN');
   if(scenario==='replacement') {
    await page.evaluate(()=>{window.storageProbe.failDraft=0;window.restart(true);});await page.locator('[data-host-epoch="1"]').waitFor();await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
    metric('retired prompt clears for replacement player',await page.locator('.player-save-notice').count(),0);
    metric('old answer never crosses target identity',await page.evaluate(()=>window.draft()),'');
   } else if(scenario==='offline') {
    metric('offline retry control waits for connectivity',await page.locator('.player-save-notice button').count()?await page.locator('.player-save-notice button').isDisabled():false,true);
    await page.evaluate(()=>{window.storageProbe.failDraft=0;Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
    metric('online acknowledgement clears prompt',await page.locator('.player-save-notice').count(),0);
   } else {
    const geometry=await page.evaluate(()=>{const n=document.querySelector('.player-save-notice')?.getBoundingClientRect(),g=document.querySelector('.game-app')?.getBoundingClientRect(),k=document.querySelector('.keyboard')?.getBoundingClientRect(),b=document.querySelector('.player-save-notice button')?.getBoundingClientRect();return {noticeFits:!!n&&n.left>=-1&&n.right<=innerWidth+1,noticeAboveGame:!!n&&!!g&&n.bottom<=g.top+1,keyboardFits:!!k&&k.top>=0&&k.bottom<=innerHeight+1,retryHeight:b?.height??0,documentFits:document.documentElement.scrollHeight<=innerHeight+1};});
    metric('prompt fits without covering game controls',geometry.noticeFits&&geometry.noticeAboveGame&&geometry.keyboardFits&&geometry.documentFits,true);
    metric('retry remains a full-size tap target',geometry.retryHeight>=44,true);
    await page.evaluate(scenario=>{window.storageProbe.failDraft=0;window.holdNextDraft();if(scenario==='preferences'){window.storageProbe.failPreferences=100;window.changePreferences();}},scenario);
    if(scenario==='preferences'){await page.evaluate(()=>window.awaitQueue());await page.clock.runFor(7001);await page.evaluate(()=>{window.storageProbe.failPreferences=0;});}
    if(baseline)await page.evaluate(()=>window.writes.recovery.wake());else await page.locator('.player-save-notice button').click();await page.clock.runFor(20);
    metric('pending manual retry keeps recovery visible',await page.locator('.player-save-notice').count(),1);
    metric('pending retry exposes busy disabled button',await page.locator('.player-save-notice button').count()?await page.locator('.player-save-notice button').evaluate(x=>x.disabled&&x.getAttribute('aria-busy')==='true'):false,true);
    await page.keyboard.type('o');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIANO');metric('answer editing stays playable during retry',await page.evaluate(()=>window.draft()),'PIANO');
    await page.evaluate(()=>window.releaseNextDraft());await page.evaluate(()=>window.awaitQueue());await page.clock.runFor(20);
    metric('prompt clears only after latest SDK acknowledgement',await page.locator('.player-save-notice').count(),0);
    metric('manual recovery persists newest answer',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIANO');
    if(scenario==='preferences')metric('all pending preferences are durable before prompt clears',await page.evaluate(()=>({highContrast:window.durableData().highContrast,reducedMotion:window.durableData().reducedMotion})),{highContrast:true,reducedMotion:false});
   }
  }
  metric('storage health never restarts provider initialization',await page.evaluate(()=>window.storageProbe.initializations),initializations);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${locale}-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
''')
