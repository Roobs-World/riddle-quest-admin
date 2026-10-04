import path from 'node:path';

// Real hosted game and Three resource objects; driver callbacks use actual DOM event dispatch.
export async function verifyContextRecovery({page,width,url,baseline,metric,output,nativeRenderer}) {
 const value=field=>page.evaluate(field=>window.probe[field],field);
 const frames=()=>page.evaluate(()=>window.pendingFrames());
 const resources=()=>page.evaluate(()=>window.liveResources());
 const settle=()=>page.waitForTimeout(100);
 const scenarios=nativeRenderer?['native-restoration','native-restoration-failure']:['restoration','restore-failure','restore-dispose-failure','loss-failure','creation-callback-failure','constructor-listener-failure','normal-retirement'];
 for(const scenario of scenarios) {
  const check=(name,actual,expected)=>metric(scenario+': '+name,actual,expected);
  await page.goto(url);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.keyboard.type('pian');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
  const token=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken);
  if(scenario==='constructor-listener-failure')await page.evaluate(()=>{window.failResource={kind:'renderer_after_listeners',occurrence:1};window.controlFrames();window.releaseScene();});
  else {
   await page.evaluate(()=>{window.controlFrames();window.releaseScene();});await page.locator('.solar-system canvas').waitFor({state:'attached'});
   await page.waitForFunction(()=>window.probe.observers.some(row=>row.active));await page.evaluate(width=>{window.resizeScene(width,844);window.step();},width);
   await check('healthy scene draws',await value('draws'),1);
   await check('healthy scene has one frame chain',await frames(),1);
  }
  let failed=false;
  if(scenario==='restoration'||scenario==='native-restoration'||scenario==='restore-failure'||scenario==='restore-dispose-failure'||scenario==='native-restoration-failure') {
   const losses=await value('driverLosses');
   if(nativeRenderer) {await page.evaluate(()=>window.nativeLoseContext());await page.waitForFunction(losses=>window.probe.driverLosses>losses,losses);}
   else await check('loss retains native preventDefault semantics',await page.evaluate(()=>window.contextEvent('webglcontextlost')),true);
   await check('lost context stops all scheduled frames',await frames(),0);
   await page.evaluate(()=>window.step(3000));await check('lost context draws nothing',await value('draws'),1);
   await page.evaluate(()=>window.pause(true));await page.locator('.game-app.paused').waitFor();
   failed=scenario.includes('failure');
   if(failed)await page.evaluate(scenario=>{window.probe.failRestore=true;if(scenario==='restore-dispose-failure')window.probe.failDispose=true;},scenario);
   if(nativeRenderer) {await page.waitForTimeout(200);await page.evaluate(()=>window.nativeRestoreContext());await page.waitForFunction(()=>window.probe.nativeRestorationEvents>0);await settle();}
   else await page.evaluate(()=>window.contextEvent('webglcontextrestored'));
   await check('paused restoration defers driver rebuilding',await value('driverRestores'),0);
   await check('paused restoration schedules no frame',await frames(),0);
   await page.evaluate(()=>window.pause(false));await page.locator('.game-app:not(.paused)').waitFor();
   if(failed&&nativeRenderer)await check('actual Three restoration encounters injected driver read',await value('nativeParameterFailures'),1);
   if(!failed) {
    await check('successful restoration invokes driver once',await value('driverRestores'),1);
    await check('resume owns one frame chain',await frames(),1);
    await page.evaluate(()=>window.step());await check('restored renderer draws again',await value('draws'),2);
    if(nativeRenderer)await check('restored renderer issues actual native graphics calls',(await value('nativeRenderCalls'))>0,true);
   }
  } else if(scenario==='loss-failure') {failed=true;await page.evaluate(()=>{window.probe.failLoss=true;window.contextEvent('webglcontextlost');});}
  else if(scenario==='creation-callback-failure') {failed=true;await page.evaluate(()=>{window.probe.failCreationError=true;window.contextEvent('webglcontextcreationerror');});}
  else if(scenario==='constructor-listener-failure') {await page.waitForFunction(()=>window.resourceSiteCalls.renderer_after_listeners>0);failed=true;}
  if(failed) {
   await check('driver failure retires every returned resource',await resources(),0);
   await check('driver failure retires all context subscriptions',await page.evaluate(()=>window.activeContextCallbacks()),0);
   await check('driver failure removes canvas',await page.locator('.solar-system canvas').count(),0);
   await check('driver failure retires frame chain',await frames(),0);
   const reports=await page.evaluate(()=>window.probe.errors.filter(row=>row.component==='solar_system'));
   await check('driver failure reports once',reports.length,scenario==='constructor-listener-failure'?0:scenario==='restore-dispose-failure'?2:1);
   if(scenario.includes('restoration-failure')||scenario==='restore-failure'||scenario==='restore-dispose-failure')await check('diagnostic identifies restoration',reports.find(row=>row.operation==='restore_context')?.operation,'restore_context');
   if(scenario==='constructor-listener-failure')await check('unreturned renderer needs no disposal',await value('disposals'),0);
   else {await check('each returned renderer is disposed once',await value('disposals'),await value('rendererConstructions'));await check('each returned renderer releases context once',await value('contextReleases'),await value('rendererConstructions'));}
   await check('failure never escapes native DOM event',await value('windowErrors'),[]);
  }
  const restores=await value('driverRestores'),losses=await value('driverLosses'),creationErrors=await value('driverCreationErrors'),reports=await page.evaluate(()=>window.probe.errors.length);
  await page.evaluate(()=>window.setMotion(true));await settle();
  await check('normal retirement releases every returned resource',await resources(),0);
  await check('normal retirement removes every context callback',await page.evaluate(()=>window.activeContextCallbacks()),0);
  await page.evaluate(()=>{window.replayContextCallbacks();window.replayFrames();window.resizeScene(390,844,true);});
  await check('retained native restoration callback cannot reinitialize driver',await value('driverRestores'),restores);
  await check('retained native loss callback cannot re-enter driver',await value('driverLosses'),losses);
  await check('retained creation callback cannot re-enter driver',await value('driverCreationErrors'),creationErrors);
  await check('retained callbacks cannot repeat diagnostics',await page.evaluate(()=>window.probe.errors.length),reports);
  await check('retained callbacks cannot recreate a frame chain',await frames(),0);
  await check('shared resources are never disposed twice',await value('duplicateReleases'),0);
  await check('PIAN draft survives context lifecycle',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.currentLetters.join('').toUpperCase()),'PIAN');
  await check('token survives context lifecycle',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken),token);
  await page.evaluate(()=>window.pause(false));await page.locator('.game-app:not(.paused)').waitFor();
  await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
  await check('player submits one preserved answer',await value('guesses'),1);
  await check('player receives one authoritative completion',await value('completions'),1);
  await check('no browser callback error remains',await value('windowErrors'),[]);
  await check('no unhandled rejection remains',await value('unhandled'),[]);
  if(!baseline&&scenario==='restore-failure')await page.screenshot({path:path.join(output,`restoration-failure-completion-${width}.png`)});
 }
}
