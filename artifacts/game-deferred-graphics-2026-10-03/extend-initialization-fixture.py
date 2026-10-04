from pathlib import Path
p=Path('packages/portal/scripts/verify-solar-animation-browser.mjs');s=p.read_text().replace('mkdir,mkdtemp,readFile,rm,writeFile','mkdir,mkdtemp,readFile,readdir,rm,writeFile')
s=s.replace("import {verifyLiveDecoration} from './verify-live-decoration-browser.mjs';", "import {verifyLiveDecoration} from './verify-live-decoration-browser.mjs';\nimport {verifySolarInitialization} from './verify-solar-initialization-browser.mjs';")
s=s.replace("const resourceChecks=process.env.SOLAR_RESOURCE_CHECKS==='1'||motionChecks;", "const initializationChecks=process.env.SOLAR_INITIALIZATION_CHECKS==='1';\nconst resourceChecks=process.env.SOLAR_RESOURCE_CHECKS==='1'||motionChecks||initializationChecks;")
s=s.replace("motionChecks?'../../artifacts/game-live-decoration-2026-10-03'", "initializationChecks?'../../artifacts/game-deferred-graphics-2026-10-03':motionChecks?'../../artifacts/game-live-decoration-2026-10-03'")
s=s.replace("const rawNow=performance.now.bind(performance);", """if(${initializationChecks}){
 const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document),active=new Set(),retained=new Set();
 document.addEventListener=(type,callback,...args)=>{if(type==='visibilitychange'&&typeof callback==='function'&&new Error().stack.includes('SolarSystem-'))active.add(callback);return add(type,callback,...args);};
 document.removeEventListener=(type,callback,...args)=>{if(type==='visibilitychange'&&active.has(callback)){active.delete(callback);retained.add(callback);}return remove(type,callback,...args);};
 window.solarVisibilityListeners=()=>active.size;window.replayVisibility=()=>{for(const callback of retained)callback();};
}
const rawNow=performance.now.bind(performance);""")
s=s.replace("let main=commonSource.replace('const source=createFakeHostServices();',injected+'\\nconst source=createFakeHostServices();');", "let injection=injected;\nif(initializationChecks)injection=injection.replace(/import \\{SolarSystem\\} from .*?;\\n/,'').replace(/function SceneProbe\\(\\).*\\n/,'');\nlet main=commonSource.replace('const source=createFakeHostServices();',injection+'\\nconst source=createFakeHostServices();');")
s=s.replace("main=main.replace(\"params.has('probe')?<HookProbe/>\"", "if(!initializationChecks)main=main.replace(\"params.has('probe')?<HookProbe/>\"")
s=s.replace("if(!motionChecks&&resourceChecks&&baseline", "if(!initializationChecks&&!motionChecks&&resourceChecks&&baseline")
s=s.replace("return source.replace('\"three/src/Three.js\"',JSON.stringify(facade));", "return (initializationChecks?'window.probe.solarImports=(window.probe.solarImports??0)+1;\\n':'')+source.replace('\"three/src/Three.js\"',JSON.stringify(facade));")
s=s.replace(" server=createServer(async(request,response)=>", " const sceneAsset=initializationChecks?(await readdir(path.join(scratch,'dist/assets'))).find(file=>file.startsWith('SolarSystem-')&&file.endsWith('.js')):undefined;\n if(initializationChecks)assert.ok(sceneAsset,'SolarSystem remains a genuinely separate lazy native module');\n await writeFile(path.join(output,'lazy-scene-asset.txt'),sceneAsset??'not applicable');\n let releaseHeldScene;const heldScene=new Promise(resolve=>releaseHeldScene=resolve);\n server=createServer(async(request,response)=>")
s=s.replace("const pathname=new URL(request.url,'http://localhost').pathname,file=", "const pathname=new URL(request.url,'http://localhost').pathname;if(initializationChecks&&process.env.SOLAR_ANIMATION_SERVE_ONLY==='1'){if(pathname==='/__fixture/release-scene'){releaseHeldScene();response.writeHead(200).end('released');return;}if(pathname==='/assets/'+sceneAsset)await heldScene;}const file=")
s=s.replace("  if(motionChecks){", "  if(initializationChecks){await verifySolarInitialization({page,width,url,baseline,metric,output,sceneAsset});await context.close();continue;}\n  if(motionChecks){")
p.write_text(s)
