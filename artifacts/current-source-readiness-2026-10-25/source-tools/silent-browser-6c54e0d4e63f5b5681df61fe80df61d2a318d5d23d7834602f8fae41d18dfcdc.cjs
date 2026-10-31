'use strict';
// Test-process preload only. Every browser is muted before launch and isolated before navigation.
if (process.env.RIDDLE_LOCAL_VERIFICATION !== '1') throw new Error('Riddle browser preload requires explicit local verification environment');
const Module = require('node:module');
const originalLoad = Module._load;
const patched = new WeakSet();
const local = value => { try { const u = new URL(value); return ['about:','data:','blob:'].includes(u.protocol) || ['localhost','127.0.0.1','[::1]'].includes(u.hostname); } catch { return false; } };
async function guardContext(context) {
  if (patched.has(context)) return context;
  patched.add(context);
  await context.route('**/*', route => local(route.request().url()) ? route.continue() : route.abort('blockedbyclient'));
  const {installSilentAudio} = await import('/home/craig-beswetherick/Documents/BeeHive/tests/helpers/silent-audio.js');
  await installSilentAudio(context);
  await context.route(/\.(?:mp3|ogg|m4a|aac|flac|webm|mp4)(?:\?|$)/i, route => route.abort('blockedbyclient'));
  await context.addInitScript(() => {
    const quiet = element => { element.muted = true; element.volume = 0; };
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
  process.stderr.write('[riddle-silent-guard] context isolated before navigation\n');
  return context;
}
function patchBrowser(browser) {
  if (patched.has(browser)) return browser;
  patched.add(browser);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => guardContext(await newContext({...options,serviceWorkers:'block'}));
  return browser;
}
function patchAPI(api) {
  if (!api || typeof api !== 'object') return;
  for (const name of ['chromium','firefox','webkit']) {
    const type=api[name];
    if (!type || patched.has(type)) continue;
    patched.add(type);
    const options = input => ({...input, ...(name==='chromium'?{args:[...new Set([...(input?.args||[]),'--mute-audio'])]}:{}), ...(name==='firefox'?{firefoxUserPrefs:{...input?.firefoxUserPrefs,'media.volume_scale':'0.0'}}:{})});
    const launch = type.launch.bind(type);
    type.launch = async input => {process.stderr.write('[riddle-silent-guard] muted '+name+' launch\n');return patchBrowser(await launch(options(input)));};
    const persistent = type.launchPersistentContext.bind(type);
    type.launchPersistentContext = async (dir,input) => guardContext(await persistent(dir,{...options(input),serviceWorkers:'block'}));
  }
}
Module._load = function (...args) { const loaded=originalLoad.apply(this,args); if (/playwright/.test(String(args[0]))) patchAPI(loaded); return loaded; };
