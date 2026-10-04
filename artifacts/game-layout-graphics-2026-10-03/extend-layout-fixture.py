from pathlib import Path
p=Path('packages/portal/scripts/verify-solar-animation-browser.mjs');s=p.read_text().replace("import {verifyContextRecovery} from './verify-context-recovery-browser.mjs';", "import {verifyContextRecovery} from './verify-context-recovery-browser.mjs';\nimport {verifyLayoutGraphics} from './verify-layout-graphics-browser.mjs';")
s=s.replace("const resourceChecks=process.env.SOLAR_RESOURCE_CHECKS==='1'||motionChecks||initializationChecks||contextChecks;", "const layoutChecks=process.env.SOLAR_LAYOUT_CHECKS==='1';\nconst resourceChecks=process.env.SOLAR_RESOURCE_CHECKS==='1'||motionChecks||initializationChecks||contextChecks||layoutChecks;")
s=s.replace("contextChecks?'../../artifacts/game-context-recovery-2026-10-03'", "layoutChecks?'../../artifacts/game-layout-graphics-2026-10-03':contextChecks?'../../artifacts/game-context-recovery-2026-10-03'")
s=s.replace("const rawObserver=window.ResizeObserver;let manual=new URL(location.href).searchParams.has('scene');", "const rawObserver=window.ResizeObserver;const directScene=new URL(location.href).searchParams.has('scene');let manual=directScene;")
s=s.replace("if(!manual||!caller.includes('/assets/'))return rawRequest(callback);", "if(!manual||!caller.includes('/assets/')||(!directScene&&!${layoutChecks}&&caller.includes('runWhenLayoutReady')))return rawRequest(callback);")
s=s.replace("constructor(callback){this.callback=callback;this.native=new rawObserver(callback);this.active=false;}", "constructor(callback){if(window.probe.failObserverConstructor){window.probe.failObserverConstructor=false;throw Error('injected observer constructor failure');}this.callback=callback;this.native=new rawObserver(callback);this.active=false;}")
s=s.replace("this.active=true;window.probe.observers.push(this);", "this.active=true;window.probe.observers.push(this);if(window.probe.failObserverObserve){window.probe.failObserverObserve=false;throw Error('injected observer observe failure');}if(!directScene&&!${layoutChecks})this.callback([{contentRect:{width:window.innerWidth,height:window.innerHeight}}]);")
s=s.replace("if(!contextChecks&&!initializationChecks&&!motionChecks&&resourceChecks&&baseline", "if(!layoutChecks&&!contextChecks&&!initializationChecks&&!motionChecks&&resourceChecks&&baseline")
s=s.replace("  if(contextChecks){", "  if(layoutChecks){await verifyLayoutGraphics({page,width,url,baseline,metric,output});await context.close();continue;}\n  if(contextChecks){")
s=s.replace("await page.locator('.solar-system canvas').waitFor({state:'attached'});await page.evaluate(()=>window.step());await page.waitForFunction", "await page.locator('.solar-system canvas').waitFor({state:'attached'});await page.waitForFunction")
s=s.replace("  if(nativeRenderer){\n   await begin();", "  if(nativeRenderer){\n   await begin();await page.evaluate(width=>window.resizeScene(width,844),width);")
p.write_text(s)
for name in ['verify-live-decoration-browser.mjs','verify-solar-initialization-browser.mjs','verify-context-recovery-browser.mjs']:
 p=Path('packages/portal/scripts')/name;s=p.read_text();s=s.replace("await page.locator('.solar-system canvas').waitFor({state:'attached'});await page.evaluate(()=>window.step());", "await page.locator('.solar-system canvas').waitFor({state:'attached'});")
 # Context's setup splits these statements across lines.
 s=s.replace("   await page.evaluate(()=>window.step());await page.waitForFunction", "   await page.waitForFunction")
 p.write_text(s)
p=Path('packages/portal/src/play/SolarSystem.tsx');s=p.read_text().replace('      contextCanvas?.dispose();\n      resources.dispose();','      contextCanvas?.dispose();\n      resizeScene = undefined;\n      measuredLayout = undefined;\n      resources.dispose();');p.write_text(s)
