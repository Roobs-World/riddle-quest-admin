const {chromium}=require('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/node_modules/@playwright/test');
const {createServer}=require('node:http');
test('guards every Jest VM context before navigation without blocking mocked provider responses',async()=>{
 let audioServerRequests=0;
 const server=createServer((request,response)=>{if(request.url.includes('/audio/'))audioServerRequests++;response.setHeader('content-type','text/html');response.end('<!doctype html><title>Guard probe</title>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{for(let index=0;index<2;index++){
  const context=await browser.newContext();
  await context.route('https://mock.example.invalid/**',route=>route.fulfill({headers:{'access-control-allow-origin':'*'},json:{ok:true}}));
  const page=await context.newPage();
  await page.route('https://blocked.example.invalid/**',route=>route.continue());
  await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
   const audio=new Audio();audio.muted=false;const context=new AudioContext();
   const wav=await fetch('/audio/probe').then(response=>response.arrayBuffer());
   const blocked=await fetch('https://blocked.example.invalid/').then(()=>false,()=>true);
   const mock=await fetch('https://mock.example.invalid/').then(response=>response.json());
   return{beforeNavigation:window.__riddleSilentBrowserGuard,muted:audio.muted,gain:context.destination.gain.value,wavHeader:String.fromCharCode(...new Uint8Array(wav).slice(0,4)),externalContinuationBlocked:blocked,mockFixtureAllowed:mock.ok};
  });
  expect(result).toEqual({beforeNavigation:true,muted:true,gain:0,wavHeader:'RIFF',externalContinuationBlocked:true,mockFixtureAllowed:true});
  await context.close();
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
 expect(audioServerRequests).toBe(0);
},20000);
