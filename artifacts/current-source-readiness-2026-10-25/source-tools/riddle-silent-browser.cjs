'use strict';
// Test-process preload only. Every browser is muted before launch and isolated before navigation.
if (process.env.RIDDLE_LOCAL_VERIFICATION !== '1') throw new Error('Riddle browser preload requires explicit local verification environment');
if (require('node:fs').existsSync('/tmp/riddle-pause-old-matrix') && process.env.RIDDLE_MATRIX_GENERATION !== 'next') { process.stderr.write('[riddle-verification-held] Source mutation boundary; queued command was not started.\n'); process.exit(125); }
const Module = require('node:module');
const originalLoad = Module._load;
const patched = new WeakSet();
const local = value => { try { const u = new URL(value); return ['about:','data:','blob:'].includes(u.protocol) || ['localhost','127.0.0.1','[::1]'].includes(u.hostname) || Boolean(process.env.RIDDLE_READONLY_BUILD_ORIGIN && u.origin===process.env.RIDDLE_READONLY_BUILD_ORIGIN); } catch { return false; } };
const guardedRoutes=new WeakSet();
function guardRoute(route){
 if(guardedRoutes.has(route))return route;
 guardedRoutes.add(route);
 const proceed=route.continue.bind(route),fetch=route.fetch.bind(route);
 route.continue=options=>local(options?.url??route.request().url())?proceed(options):route.abort('blockedbyclient');
 route.fetch=options=>{if(!local(options?.url??route.request().url()))throw new Error('External route fetch blocked by local verification');return fetch(options);};
 return route;
}
function guardRouteRegistration(target){
 const register=target.route.bind(target);
 target.route=(url,handler,options)=>register(url,(route,request)=>handler(guardRoute(route),request),options);
}
async function guardContext(context) {
  if (patched.has(context)) return context;
  patched.add(context);
  await context.route('**/*', route => local(route.request().url()) ? route.continue() : route.abort('blockedbyclient'));
  const {installSilentAudio} = require('/tmp/riddle-shared-silent-audio.cjs');
  await installSilentAudio(context);
  await context.route(/\.(?:mp3|ogg|m4a|aac|flac|webm|mp4)(?:\?|$)/i, route => route.abort('blockedbyclient'));
  await context.addInitScript(() => {
    const quiet = element => { element.muted = true; element.volume = 0; };
    const muted=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'muted');
    Object.defineProperty(HTMLMediaElement.prototype,'muted',{configurable:true,get:()=>true,set(value){muted?.set?.call(this,true);}});
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { quiet(this); return play.apply(this,args); };
    document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement) quiet(event.target); }, true);
    for (const key of ['AudioContext','webkitAudioContext']) {
      const Original = window[key];
      if (!Original) continue;
      window[key] = class extends Original {
        constructor(...args) {
          super(...args);
          const destination = super.destination;
          const sink = this.createGain();
          sink.gain.value = 0;
          sink.connect(destination);
          Object.defineProperty(this,'destination',{get:()=>sink});
        }
      };
    }
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        const parsed = new URL(url, location.href);
        if (!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error('External WebSocket blocked by local verification');
        super(url, protocols);
      }
    };
    Object.defineProperty(window,'__riddleSilentBrowserGuard',{value:true});
  });
  guardRouteRegistration(context);
  const newPage=context.newPage.bind(context);
  context.newPage=async()=>{const page=await newPage();guardRouteRegistration(page);return page;};
  process.stderr.write('[riddle-silent-guard] context isolated before navigation\n');
  return context;
}
function patchBrowser(browser) {
  if (patched.has(browser)) return browser;
  patched.add(browser);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => guardContext(await newContext({...options,...(process.env.RIDDLE_ALLOW_LOCAL_SERVICE_WORKER==='1'?{}:{serviceWorkers:'block'})}));
  return browser;
}
function patchAPI(api) {
  if (!api || !['object','function'].includes(typeof api)) return;
  for (const name of ['chromium','firefox','webkit']) {
    const type=api[name];
    if (!type || patched.has(type)) continue;
    patched.add(type);
    const options = input => ({...input, ...(name==='chromium'?{args:[...new Set([...(input?.args||[]),'--mute-audio'])]}:{}), ...(name==='firefox'?{firefoxUserPrefs:{...input?.firefoxUserPrefs,'media.volume_scale':'0.0'}}:{})});
    const launch = type.launch.bind(type);
    type.launch = async input => {process.stderr.write('[riddle-silent-guard] muted '+name+' launch\n');return patchBrowser(await launch(options(input)));};
    const persistent = type.launchPersistentContext.bind(type);
    type.launchPersistentContext = async (dir,input) => guardContext(await persistent(dir,{...options(input),...(process.env.RIDDLE_ALLOW_LOCAL_SERVICE_WORKER==='1'?{}:{serviceWorkers:'block'})}));
  }
}
Module._load = function (...args) {
 const loaded=originalLoad.apply(this,args),request=String(args[0]);
 if(/playwright/.test(request))patchAPI(loaded);
 if(process.env.PORTAL_BROWSER_TESTS==='1' && ['/home/craig-beswetherick/Documents/riddle-quest/packages/portal/jest.config.cjs','/tmp/riddle-jest-guard-probe/jest.config.cjs'].includes(request)){
  const setup='/tmp/riddle-jest-silent-setup.cjs';
  if(!loaded.setupFilesAfterEnv?.includes(setup)){
   loaded.setupFilesAfterEnv=[...(loaded.setupFilesAfterEnv??[]),setup];
   process.stderr.write('[riddle-silent-guard] environment-owned Jest setup bridge installed before test modules\n');
  }
 }
 return loaded;
};
module.exports={patchAPI,isGuardedBrowserType:type=>patched.has(type)};
