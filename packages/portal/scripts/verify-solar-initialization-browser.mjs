import path from 'node:path';

// Holds the actual lazy native module download; only GPU calls and clocks are controlled.
export async function verifySolarInitialization({page,width,url,baseline,metric,output,sceneAsset,mode}) {
 const settle=()=>page.waitForTimeout(100);
 const value=field=>page.evaluate(field=>window.probe[field],field);
 const resources=()=>page.evaluate(()=>window.liveResources());
 const frames=()=>page.evaluate(()=>window.pendingFrames());
 const draft=()=>page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.currentLetters.join('').toUpperCase());
 const token=()=>page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.sessionToken);
 const setMotion=async value=>{await page.evaluate(value=>window.setMotion(value),value);await settle();};
 const openRace=async()=>{await page.getByRole('button',{name:'Multiplayer',exact:true}).click();await page.getByTestId('provider-race').waitFor();};
 const closeRace=async()=>{await page.getByRole('button',{name:'Return to puzzle',exact:true}).click();await page.getByTestId('provider-race').waitFor({state:'detached'});await settle();};
 for(const scenario of ['host-pause','multiplayer','hidden-document','motion-in-multiplayer','retired-before-resume','deferred-driver-failure']) {
  let releaseDownload,downloadReached,requests=0;
  const gate=new Promise(resolve=>releaseDownload=resolve),reached=new Promise(resolve=>downloadReached=resolve);
  await page.route(`**/assets/${sceneAsset}`,async route=>{requests++;downloadReached();await gate;await route.continue();});
  await page.goto(url+'?custom=1&harness=race');await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.keyboard.type('pia');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIA'));
  const ownedToken=await token();
  await page.evaluate(()=>{window.controlFrames();window.releaseScene();});await reached;
  await page.keyboard.type('n');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
  const check=(name,actual,expected)=>metric(scenario+': '+name,actual,expected);
  await check('pending native download leaves typing usable',await draft(),'PIAN');
  await check('pending download allocates no renderer',await value('rendererConstructions'),0);
  if(scenario==='multiplayer'||scenario==='motion-in-multiplayer')await openRace();
  else if(scenario==='hidden-document')await page.evaluate(()=>window.visibility(true));
  else await page.evaluate(()=>window.pause(true));
  if(scenario==='motion-in-multiplayer')await setMotion(true);
  releaseDownload();await page.waitForFunction(()=>window.probe.solarImports===1);
  if(scenario==='motion-in-multiplayer')await setMotion(false);
  await page.locator('[data-testid=solar-system]').waitFor({state:'attached'});await settle();
  await check('native module evaluates once',await value('solarImports'),1);
  await check('native module uses one download',requests,1);
  await check('blocked first render constructs no renderer',await value('rendererConstructions'),0);
  await check('blocked first render owns no graphics allocations',await resources(),0);
  await check('blocked first render requests no texture images',await page.evaluate(()=>window.probe.textureCallbacks.length),0);
  await check('blocked first render creates no resize observer',await page.evaluate(()=>window.probe.observers.filter(row=>row.active).length),0);
  await check('blocked first render schedules no frame',await frames(),0);
  await check('blocked first render attaches no canvas',await page.locator('.solar-system canvas').count(),0);
  await check('blocked construction preserves token',await token(),ownedToken);
  await page.evaluate(()=>window.replayVisibility());await settle();
  await check('retained setup callbacks cannot allocate while blocked',await resources(),0);
  if(scenario==='retired-before-resume') {
   await setMotion(true);
   await page.evaluate(()=>{window.visibility(false);window.pause(false);window.replayVisibility();window.replayFrames();});await settle();
   await check('retired pending setup releases its visibility subscription',await page.evaluate(()=>window.solarVisibilityListeners()),0);
   await check('retired pending setup attaches no canvas',await page.locator('.solar-system canvas').count(),0);
   await check('retired setup callbacks cannot create resources',await resources(),0);
   await check('retired setup callbacks cannot construct a renderer',await value('rendererConstructions'),0);
   await setMotion(false);
  } else if(scenario==='multiplayer'||scenario==='motion-in-multiplayer')await closeRace();
  else if(scenario==='hidden-document')await page.evaluate(()=>window.visibility(false));
  else {
   if(scenario==='deferred-driver-failure')await page.evaluate(()=>{window.failResource={kind:'MeshBasicMaterial',occurrence:1};});
   await page.evaluate(()=>window.pause(false));
  }
  // Scene construction is asynchronous; wait for it instead of a fixed delay, then settle so a second construction would still show.
  await page.waitForFunction(()=>window.probe.rendererConstructions>=1,undefined,{timeout:15000}).catch(()=>{});await settle();
  const expectedConstructors=1;
  await check('first eligible state initializes only its current owner',await value('rendererConstructions'),expectedConstructors);
  if(scenario==='deferred-driver-failure') {
   await check('failed deferred setup releases partial resources',await resources(),0);
   await check('failed deferred setup releases its context',await value('contextReleases'),1);
   await check('failed deferred setup disposes its renderer',await value('disposals'),1);
   await check('failed deferred setup has no frame chain',await frames(),0);
   await check('failed deferred setup has no canvas',await page.locator('.solar-system canvas').count(),0);
   await check('failed deferred setup reports once',await page.evaluate(()=>window.probe.errors.filter(row=>row.operation==='initialize_scene').length),1);
  } else {
   await page.locator('.solar-system canvas').waitFor({state:'attached'});
   await page.waitForFunction(()=>window.probe.observers.some(row=>row.active));await page.evaluate(width=>{window.resizeScene(width,844);window.step();},width);
   await check('resumed scene draws actual Three objects',await value('draws'),1);
   await check('resumed scene owns one frame chain',await frames(),1);
   await check('resumed scene owns one attached canvas',await page.locator('.solar-system canvas').count(),1);
  }
  const constructors=await value('rendererConstructions'),diagnostics=await page.evaluate(()=>window.probe.errors.length);
  await page.evaluate(()=>{window.visibility(true);window.visibility(false);window.replayVisibility();window.pause(true);});await settle();
  await page.evaluate(()=>window.pause(false));await settle();
  await check('later visibility and pause changes never reconstruct',await value('rendererConstructions'),constructors);
  await check('retained setup callbacks never repeat diagnostics',await page.evaluate(()=>window.probe.errors.length),diagnostics);
  await setMotion(true);
  await page.evaluate(()=>{window.replayVisibility();window.replayFrames();window.resizeScene(390,844,true);for(const row of window.probe.textureCallbacks)row.onError?.(Error('retained image error'));});
  await check('unmount releases every graphics allocation',await resources(),0);
  await check('unmount releases every scene visibility listener',await page.evaluate(()=>window.solarVisibilityListeners()),0);
  await check('unmount retires the frame chain',await frames(),0);
  await check('unmount removes its canvas',await page.locator('.solar-system canvas').count(),0);
  await check('shared resources are never disposed twice',await value('duplicateReleases'),0);
  await check('retired callbacks never reconstruct the scene',await value('rendererConstructions'),constructors);
  await check('retired callbacks never repeat diagnostics',await page.evaluate(()=>window.probe.errors.length),diagnostics);
  await check('draft survives slow loading and deferred setup',await draft(),'PIAN');
  await check('token survives slow loading and deferred setup',await token(),ownedToken);
  await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
  await check('player completes the same answer',await value('guesses'),1);
  await check('completion remains authoritative and singular',await value('completions'),1);
  await check('no browser callback error escapes',await value('windowErrors'),[]);
  await check('no promise rejection remains unhandled',await value('unhandled'),[]);
  if(!baseline&&scenario==='multiplayer')await page.screenshot({path:path.join(output,`deferred-multiplayer-completion-${width}.png`)});
  await page.unroute(`**/assets/${sceneAsset}`);
 }
}
