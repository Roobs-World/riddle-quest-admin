import path from 'node:path';

// Actual hosted frame, dimensions and Three objects; native mode also records real canvas writes.
export async function verifySolarSizing({page,width,url,baseline,metric,output,nativeRenderer}) {
 const value=field=>page.evaluate(field=>window.probe[field],field),frames=()=>page.evaluate(()=>window.pendingFrames()),live=()=>page.evaluate(()=>window.liveResources()),settle=()=>page.waitForTimeout(100);
 const check=(name,actual,expected)=>metric(name,actual,expected);
 await page.goto(url+'?custom=1&harness=race');await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
 if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
 await page.keyboard.type('pian');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
 const token=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken);
 await page.evaluate(()=>{window.controlFrames();window.releaseScene();});await page.locator('.solar-system canvas').waitFor();await page.waitForFunction(()=>window.probe.observers.some(row=>row.active));
 await page.evaluate(width=>{window.resizeScene(width+.7,843.8);window.step();},width);await check('initial eligible scene draws',await value('draws'),1);
 let resets=await value('resizes'),writes=await value('bufferAssignments');
 await page.evaluate(width=>{for(let i=0;i<180;i++)window.resizeScene(width+.1+(i%8)/10,843.1+(i%8)/10);},width);
 await check('180 equivalent fractional measurements do not reset buffer',await value('resizes'),resets);
 if(nativeRenderer)await check('equivalent measurements perform zero actual canvas writes',await value('bufferAssignments'),writes);
 await check('equivalent measurements retain one frame chain',await frames(),1);
 await page.evaluate(width=>window.resizeScene(width+1.2,843.5),width);await check('changed integer dimensions reset once',await value('resizes'),resets+1);resets=await value('resizes');
 await page.evaluate(width=>{window.resizeScene(0,0);window.step(3000);window.resizeScene(width+1.9,843.9);},width);
 await check('collapse and same-size recovery do not reset buffer',await value('resizes'),resets);await check('collapse and recovery resume one chain',await frames(),1);await check('collapse draws nothing',await value('draws'),1);
 for(const state of ['host-pause','hidden','multiplayer']) {
  if(state==='host-pause'){await page.evaluate(()=>window.pause(true));await page.locator('.game-app.paused').waitFor();}
  if(state==='hidden')await page.evaluate(()=>window.visibility(true));
  if(state==='multiplayer'){await page.getByRole('button',{name:'Multiplayer',exact:true}).click();await page.getByTestId('provider-race').waitFor();}
  writes=await value('bufferAssignments');const offset=state==='host-pause'?100:state==='hidden'?200:300;
  await page.evaluate(({width,offset})=>{for(let i=0;i<120;i++)window.resizeScene(width+offset+i+.7,600+i+.8);}, {width,offset});
  await check(state+': 120 measurements do not resize inactive graphics',await value('resizes'),resets);await check(state+': no frame chain',await frames(),0);
  if(nativeRenderer)await check(state+': zero actual buffer writes',await value('bufferAssignments'),writes);
  if(state==='host-pause'){await page.evaluate(()=>window.pause(false));await page.locator('.game-app:not(.paused)').waitFor();}
  if(state==='hidden')await page.evaluate(()=>window.visibility(false));
  if(state==='multiplayer'){await page.getByRole('button',{name:'Return to puzzle',exact:true}).click();await page.getByTestId('provider-race').waitFor({state:'detached'});await settle();}
  await check(state+': first eligible refresh applies latest size once',await value('resizes'),resets+1);await check(state+': applies the latest integer dimensions',await page.evaluate(()=>window.probe.sizes.at(-1)),[width+offset+119,719]);await check(state+': resumes one frame chain',await frames(),1);resets=await value('resizes');
 }
 if(nativeRenderer){await page.evaluate(()=>window.nativeLoseContext());await page.waitForFunction(()=>window.probe.driverLosses===1);}else await page.evaluate(()=>window.contextEvent('webglcontextlost'));
 await page.evaluate(width=>{for(let i=0;i<120;i++)window.resizeScene(width+500+i+.9,700+i+.9);},width);await check('lost context defers all resize work',await value('resizes'),resets);await check('lost context owns no frame',await frames(),0);
 if(nativeRenderer){await page.waitForTimeout(200);await page.evaluate(()=>window.nativeRestoreContext());await page.waitForFunction(()=>window.probe.driverRestores===1);}else await page.evaluate(()=>window.contextEvent('webglcontextrestored'));
 await check('restoration applies latest size before drawing',await page.evaluate(()=>window.probe.sizes.at(-1)),[width+619,819]);await check('restoration resizes once',await value('resizes'),resets+1);resets=await value('resizes');
 await page.evaluate(width=>{window.resizeScene(width+619.1,819.1);window.step();},width);await check('same-size measurement after restoration does not reset',await value('resizes'),resets);await check('restored scene draws again',await value('draws'),2);
 if(nativeRenderer){const bounds=await page.evaluate(()=>{const canvas=document.querySelector('.solar-system canvas'),viewport=window.nativeViewport();return {buffer:[canvas.width,canvas.height],viewport,dpr:Math.min(devicePixelRatio,1.5)};});await check('real drawing buffer uses latest bounded size',bounds.buffer,[Math.floor((width+619)*bounds.dpr),Math.floor(819*bounds.dpr)]);await check('real viewport stays inside buffer',bounds.viewport[2]<=bounds.buffer[0]&&bounds.viewport[3]<=bounds.buffer[1],true);await check('actual graphics calls draw',(await value('nativeRenderCalls'))>0,true);}
 else {await page.evaluate(width=>{window.probe.failResize=true;window.resizeScene(width+999,500);},width);await check('changed-size failure retires resources',await live(),0);await check('changed-size failure reports once',await page.evaluate(()=>window.probe.errors.filter(row=>row.operation==='resize_scene').length),1);}
 await page.evaluate(()=>window.setMotion(true));await settle();const reports=await page.evaluate(()=>window.probe.errors.length),draws=await value('draws');await page.evaluate(()=>{window.resizeScene(390,844,true);window.replayFrames();window.replayContextCallbacks();window.visibility(false);window.pause(false);});await settle();
 await check('retained resize cannot touch retired buffer',await value('resizes'),nativeRenderer?resets:resets+1);await check('retired graphics resources',await live(),0);await check('retired context listeners',await page.evaluate(()=>window.activeContextCallbacks()),0);await check('retired frame chain',await frames(),0);await check('retained callbacks cannot draw',await value('draws'),draws);await check('retained callbacks cannot repeat diagnostic',await page.evaluate(()=>window.probe.errors.length),reports);await check('no duplicate release',await value('duplicateReleases'),0);
 await check('draft survives all sizing transitions',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.currentLetters.join('').toUpperCase()),'PIAN');await check('authority token survives sizing transitions',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken),token);
 await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);await check('one submitted answer',await value('guesses'),1);await check('one completion',await value('completions'),1);await check('no browser errors',await value('windowErrors'),[]);await check('no unhandled promise',await value('unhandled'),[]);
 if(!baseline)await page.screenshot({path:path.join(output,`sizing-completion-${width}.png`)});
}
