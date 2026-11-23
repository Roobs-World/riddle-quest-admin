import {openSolarGame} from './solar-browser-fixture.mjs';
import path from 'node:path';

// Actual hosted game, Three resources and DOM event dispatch; native mode uses real WebGL.
export async function verifyDeferredRestoration({page,width,url,baseline,metric,output,nativeRenderer}) {
 const value=field=>page.evaluate(field=>window.probe[field],field),frames=()=>page.evaluate(()=>window.pendingFrames()),live=()=>page.evaluate(()=>window.liveResources()),settle=()=>page.waitForTimeout(100);
 for(const scenario of nativeRenderer?['hidden','resume-failure']:['hidden','zero-layout','multiplayer','retire-pending','newer-loss','resume-failure']) {
  const check=(name,actual,expected)=>metric(scenario+': '+name,actual,expected);
  await openSolarGame(page,url+'?custom=1&harness=race');
  await page.keyboard.type('pian');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
  const token=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken);
  await page.evaluate(()=>{window.controlFrames();window.releaseScene();});await page.locator('.solar-system canvas').waitFor();await page.waitForFunction(()=>window.probe.observers.some(row=>row.active));
  await page.evaluate(width=>{window.resizeScene(width,844);window.step();},width);await check('healthy draw',await value('draws'),1);
  if(nativeRenderer){await page.evaluate(()=>window.nativeLoseContext());await page.waitForFunction(()=>window.probe.driverLosses===1);}else await page.evaluate(()=>window.contextEvent('webglcontextlost'));
  await check('loss stops frames',await frames(),0);
  if(scenario==='hidden')await page.evaluate(()=>window.visibility(true));
  else if(scenario==='zero-layout')await page.evaluate(()=>window.resizeScene(0,0));
  else if(scenario==='multiplayer'){await page.getByRole('button',{name:'Multiplayer',exact:true}).click();await page.getByTestId('provider-race').waitFor();}
  else {await page.evaluate(()=>window.pause(true));await page.locator('.game-app.paused').waitFor();}
  if(scenario==='resume-failure')await page.evaluate(()=>window.probe.failRestore=true);
  if(nativeRenderer){await page.waitForTimeout(200);await page.evaluate(()=>window.nativeRestoreContext());await page.waitForFunction(()=>window.probe.nativeRestorationEvents>0);await settle();}
  else await page.evaluate(()=>{window.contextEvent('webglcontextrestored');if(document.querySelector('.solar-system canvas'))window.contextEvent('webglcontextrestored');});
  // Current sprite scene owns 74 resources; the retired point-cloud pair is absent.
  await check('blocked driver rebuilds',await value('driverRestores'),0);await check('blocked frame chain',await frames(),0);await check('blocked diagnostic count',await page.evaluate(()=>window.probe.errors.length),0);await check('blocked live resources',await live(),74);
  await page.evaluate(()=>window.step(3000));await check('blocked draw count',await value('draws'),1);
  if(scenario==='retire-pending'){await page.evaluate(()=>window.setMotion(true));await settle();await page.evaluate(()=>window.pause(false));}
  else if(scenario==='hidden')await page.evaluate(()=>window.visibility(false));
  else if(scenario==='zero-layout')await page.evaluate(width=>window.resizeScene(width,844),width);
  else if(scenario==='multiplayer'){await page.getByRole('button',{name:'Return to puzzle',exact:true}).click();await page.getByTestId('provider-race').waitFor({state:'detached'});await settle();}
  else {if(scenario==='newer-loss')await page.evaluate(()=>window.contextEvent('webglcontextlost'));await page.evaluate(()=>window.pause(false));await page.locator('.game-app:not(.paused)').waitFor();
   if(scenario==='newer-loss'){await check('newer loss invalidates pending restore',await value('driverRestores'),0);await check('newer loss keeps frame stopped',await frames(),0);await page.evaluate(()=>window.contextEvent('webglcontextrestored'));}}
  if(scenario==='retire-pending'){await check('retired pending driver rebuilds',await value('driverRestores'),0);await check('retired pending resources',await live(),0);}
  else {await check('eligible driver rebuilds once',await value('driverRestores'),1);
   if(scenario==='resume-failure'){await check('failure retires resources',await live(),0);await check('failure stops frames',await frames(),0);await check('failure reports once',await page.evaluate(()=>window.probe.errors.filter(row=>row.operation==='restore_context').length),1);if(nativeRenderer)await check('actual driver read fails once',await value('nativeParameterFailures'),1);}
   else {await check('eligible frame chain',await frames(),1);await page.evaluate(()=>window.step());await check('eligible draws again',await value('draws'),2);if(nativeRenderer)await check('actual native draw calls',(await value('nativeRenderCalls'))>0,true);}}
  const restored=await value('driverRestores'),reports=await page.evaluate(()=>window.probe.errors.length);
  await page.evaluate(()=>window.setMotion(true));await settle();await page.evaluate(()=>{window.replayContextCallbacks();window.replayFrames();window.resizeScene(390,844,true);window.visibility(false);window.pause(false);});await settle();
  await check('retained callbacks cannot rebuild',await value('driverRestores'),restored);await check('retained callbacks do not repeat errors',await page.evaluate(()=>window.probe.errors.length),reports);await check('retired resources',await live(),0);await check('retired context listeners',await page.evaluate(()=>window.activeContextCallbacks()),0);await check('retired frames',await frames(),0);await check('no duplicate releases',await value('duplicateReleases'),0);await check('restoration reuses renderer',await value('rendererConstructions'),1);
  await check('draft preserved',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.currentLetters.join('').toUpperCase()),'PIAN');await check('token preserved',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken),token);
  await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
  await check('one submitted answer',await value('guesses'),1);await check('one completion',await value('completions'),1);await check('no browser error',await value('windowErrors'),[]);await check('no unhandled promise',await value('unhandled'),[]);
  if(!baseline&&scenario==='hidden')await page.screenshot({path:path.join(output,`restored-completion-${width}.png`)});
 }
}
