import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "artifacts/retained-creator-recovery-2026-10-10");
await mkdir(output, {recursive:true});
await mkdir(path.join(root,"node_modules/.cache"), {recursive:true});
const scratch = await mkdtemp(path.join(root,"node_modules/.cache/retained-creator-"));
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {useRaceSession} from ${JSON.stringify(path.join(root,'src/web/play/race/hooks/useRaceSession.ts'))};
import {RaceChallengePanel} from ${JSON.stringify(path.join(root,'src/web/play/race/components/RaceLobbyPanels.tsx'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
import ${JSON.stringify(path.join(root,'src/web/styles.race-lobby.css'))};
const kind=new URL(location.href).searchParams.get('kind');
const invitation={claimState:'unclaimed',publicationState:'published',role:'creator',canCancel:true,expiresAtMs:Date.now()+60000};
window.commands=[];
async function postToHost(message){
 window.commands.push({type:message.type,payload:message.payload});
 let operation,data;
 if(message.type==='game:getRaceEntry'){
  operation='raceEntry';
  data=kind==='creator'&&localStorage.getItem('retained-cancelled')==='1'
   ?{status:'cancelled',invitation:{...invitation,canCancel:false},serverNowMs:Date.now()}
   :{status:'unavailable',reason:kind==='blocked'?'blocked':'invalid',...(kind==='creator'?{invitation}:{}),serverNowMs:Date.now()};
 }else if(message.type==='game:cancelRaceInvite'){
  if(kind!=='creator')throw Error('Unauthorized cancellation');
  await new Promise(resolve=>setTimeout(resolve,100));
  localStorage.setItem('retained-cancelled','1');
  operation='raceInviteCancel';data={status:'cancelled',invitation:{...invitation,canCancel:false},serverNowMs:Date.now()};
 }else throw Error('Unexpected authority command '+message.type);
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));
}
function App(){
 const {session,state}=useRaceSession({ownerId:'retained-owner',locale:'en',challengeId:'retained-fixture'},{postToHost});
 return <section className='race-screen' role='dialog' aria-label='Retained invitation'><RaceChallengePanel challenge={state.challenge} entryStatus={state.entryStatus} busy={Boolean(state.pending)} onCancel={session.cancelInvitation} onAccept={()=>{throw Error('Invalid recording must not start');}}/></section>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;
const outcomes=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{
  try{
   const pathname=new URL(request.url,'http://localhost').pathname;
   const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
   response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
   response.end(await readFile(file));
  }catch{response.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});
 for(const width of [1280,390])for(const kind of ['creator','legacy','recipient','blocked']){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===origin||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
   external.push(url.origin);return route.abort();
  });
  await page.goto(`${origin}/?kind=${kind}`);
  await page.locator('.race-challenge-card [role=status]').waitFor();
  const cancel=page.getByRole('button',{name:/cancel invitation/i});
  if(kind==='creator'){
   await cancel.waitFor();
   assert.ok((await cancel.boundingBox()).height>=48,'Cancellation retains its touch target');
   await page.screenshot({path:path.join(output,`creator-${width}.png`)});
   await cancel.evaluate(button=>{button.click();button.click();});
   await page.locator('.race-challenge-card [role=status]').filter({hasText:/cancelled/i}).waitFor();
   assert.equal(await page.evaluate(()=>window.commands.filter(c=>c.type==='game:cancelRaceInvite').length),1);
   assert.equal(await page.evaluate(()=>window.commands.find(c=>c.type==='game:cancelRaceInvite').payload.challengeId),'retained-fixture');
   assert.equal(await cancel.count(),0);
   await page.reload();
   await page.locator('.race-challenge-card [role=status]').filter({hasText:/cancelled/i}).waitFor();
   assert.equal(await cancel.count(),0);
   assert.equal(await page.evaluate(()=>window.commands.filter(c=>c.type==='game:cancelRaceInvite').length),0);
  }else{
   assert.equal(await cancel.count(),0);
   assert.equal(await page.evaluate(()=>window.commands.filter(c=>c.type!=='game:getRaceEntry').length),0);
  }
  assert.equal(await page.getByRole('button',{name:/accept challenge/i}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  outcomes.push({width,kind,cancellation:kind==='creator',noRecordedStart:true,errors:0,externalRequests:0});
  await context.close();
 }
 const result={verifiedAt:new Date().toISOString(),scope:'Retained recorded controller and panel only; current LiveRaceEntry is unchanged.',outcomes};
 await writeFile(path.join(output,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(scratch,{recursive:true,force:true});
}
