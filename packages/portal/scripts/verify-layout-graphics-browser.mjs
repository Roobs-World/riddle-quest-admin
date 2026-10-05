import path from 'node:path';

// Actual hosted game and Three objects; layout deliveries and the graphics driver are controlled.
export async function verifyLayoutGraphics({page,width,url,baseline,metric,output}) {
 const value=field=>page.evaluate(field=>window.probe[field],field), frames=()=>page.evaluate(()=>window.pendingFrames()),live=()=>page.evaluate(()=>window.liveResources());
 for(const scenario of ['measurement','host-pause','document-hidden','multiplayer','retire-pending','observer-constructor-failure','observer-observe-failure']) {
  const check=(name,actual,expected)=>metric(scenario+': '+name,actual,expected);
  await page.goto(url+'?custom=1&harness=race');await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.keyboard.type('pian');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
  const token=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken);
  await page.evaluate(()=>{window.controlFrames();window.releaseScene();});await page.waitForFunction(()=>window.pendingFrames()>0);
  await check('unmeasured renderer count',await value('rendererConstructions'),0);await check('unmeasured allocations',await live(),0);
  await check('unmeasured texture requests',await page.evaluate(()=>window.probe.textureCallbacks.length),0);await check('one layout callback',await frames(),1);
  if(scenario==='observer-constructor-failure')await page.evaluate(()=>window.probe.failObserverConstructor=true);
  if(scenario==='observer-observe-failure')await page.evaluate(()=>window.probe.failObserverObserve=true);
  await page.evaluate(()=>window.step());
  if(scenario.includes('failure')) {
   await check('observer failure renderer count',await value('rendererConstructions'),0);await check('observer failure allocations',await live(),0);await check('observer failure frame count',await frames(),0);
   await check('observer failure disconnects observer',await page.evaluate(()=>window.probe.observers.filter(row=>row.active).length),0);
   const reports=await page.evaluate(()=>window.probe.errors.filter(row=>row.component==='solar_system'));
   await check('observer failure reports once',reports.length,1);await check('observer failure operation',reports[0]?.operation,'observe_scene');
  } else {
   await check('active measurement subscription',await page.evaluate(()=>window.probe.observers.filter(row=>row.active).length),1);await check('no measurement polling frame',await frames(),0);
   for(const size of [[0,0],[-1,844],[width,0],[Infinity,844],[width,NaN]]) {
    await page.evaluate(size=>window.resizeScene(...size),size);
    await check('invalid '+String(size)+' renderer count',await value('rendererConstructions'),0);await check('invalid '+String(size)+' allocations',await live(),0);await check('invalid '+String(size)+' frames',await frames(),0);
   }
   if(scenario==='host-pause'){await page.evaluate(()=>window.pause(true));await page.locator('.game-app.paused').waitFor();}
   if(scenario==='document-hidden')await page.evaluate(()=>window.visibility(true));
   if(scenario==='multiplayer'){await page.getByRole('button',{name:'Multiplayer',exact:true}).click();await page.getByTestId('provider-race').waitFor();}
   if(scenario==='retire-pending'){await page.evaluate(()=>window.setMotion(true));await page.waitForTimeout(100);}
   await page.evaluate(width=>window.resizeScene(width+.7,843.8),width);
   if(scenario!=='measurement') {await check('blocked positive renderer count',await value('rendererConstructions'),0);await check('blocked positive allocations',await live(),0);await check('blocked positive frames',await frames(),0);}
   if(scenario==='host-pause'){await page.evaluate(()=>window.pause(false));await page.locator('.game-app:not(.paused)').waitFor();}
   if(scenario==='document-hidden')await page.evaluate(()=>window.visibility(false));
   if(scenario==='multiplayer'){await page.getByRole('button',{name:'Return to puzzle',exact:true}).click();await page.getByTestId('provider-race').waitFor({state:'detached'});await page.waitForTimeout(100);}
   if(scenario!=='retire-pending') {
    // Renderer + sun/corona/shooting stars (15), seven planets (35), six moons (18), two rings (6).
    await page.locator('.solar-system canvas').waitFor();await check('positive layout constructs once',await value('rendererConstructions'),1);await check('positive layout live resources',await live(),74);
    await check('first measurement sizes buffer immediately',await value('resizes'),1);await check('one animation chain',await frames(),1);
    await page.evaluate(()=>window.step());await check('first draw',await value('draws'),1);
    await page.evaluate(()=>window.resizeScene(0,0));await check('collapse stops frames',await frames(),0);await page.evaluate(()=>window.step(3000));await check('collapse draws nothing',await value('draws'),1);
    await page.evaluate(width=>{window.resizeScene(width,844);window.step();},width);await check('restored layout draws again',await value('draws'),2);await check('restore reuses renderer',await value('rendererConstructions'),1);
   }
  }
  await page.evaluate(()=>window.setMotion(true));await page.waitForTimeout(100);const constructors=await value('rendererConstructions'),reports=await page.evaluate(()=>window.probe.errors.length);
  await page.evaluate(()=>{window.resizeScene(390,844,true);window.replayFrames();window.visibility(false);});
  await check('retained callbacks cannot construct',await value('rendererConstructions'),constructors);await check('retired resources',await live(),0);await check('retired frames',await frames(),0);
  await check('retired observers',await page.evaluate(()=>window.probe.observers.filter(row=>row.active).length),0);await check('diagnostic count stable',await page.evaluate(()=>window.probe.errors.length),reports);await check('no duplicate disposals',await value('duplicateReleases'),0);
  await check('draft retained',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.currentLetters.join('').toUpperCase()),'PIAN');await check('token retained',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame).activeGame.sessionToken),token);
  await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
  await check('answer submits once',await value('guesses'),1);await check('completion once',await value('completions'),1);await check('no browser errors',await value('windowErrors'),[]);await check('no unhandled promises',await value('unhandled'),[]);
  if(!baseline&&scenario==='measurement')await page.screenshot({path:path.join(output,`layout-restored-completion-${width}.png`)});
 }
}
