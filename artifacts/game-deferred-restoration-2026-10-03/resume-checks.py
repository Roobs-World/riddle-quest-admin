import subprocess,os,json
from pathlib import Path
root=Path('/home/craig-beswetherick/Documents/riddle-quest'); out=root/'artifacts/game-deferred-restoration-2026-10-03'; portal=root/'packages/portal'
rows=json.loads((out/'browser-results.json').read_text())[:-1]
checks=[('native-restoration',{'SOLAR_RESTORATION_CHECKS':'1','SOLAR_ANIMATION_NATIVE_RENDERER':'1','SOLAR_ANIMATION_REACT_MODE':'production'}),('layout-regression',{'SOLAR_LAYOUT_CHECKS':'1'}),('restoration-production',{'SOLAR_RESTORATION_CHECKS':'1','SOLAR_ANIMATION_REACT_MODE':'production'}),('restoration-baseline',{'SOLAR_RESTORATION_CHECKS':'1','SOLAR_ANIMATION_BASELINE_DIR':str(out)}),('animation-regression',{}),('resources-regression',{'SOLAR_RESOURCE_CHECKS':'1'}),('motion-regression',{'SOLAR_MOTION_CHECKS':'1'}),('initialization-regression',{'SOLAR_INITIALIZATION_CHECKS':'1'}),('context-regression',{'SOLAR_CONTEXT_CHECKS':'1'}),('native-context',{'SOLAR_CONTEXT_CHECKS':'1','SOLAR_ANIMATION_NATIVE_RENDERER':'1','SOLAR_ANIMATION_REACT_MODE':'production'}),('native-renderer',{'SOLAR_ANIMATION_NATIVE_RENDERER':'1','SOLAR_ANIMATION_REACT_MODE':'production'})]
for name,extra in checks:
 if name in ['native-restoration','layout-regression','restoration-production']:continue
 modes=['development','production'] if name.endswith('regression') else [extra.get('SOLAR_ANIMATION_REACT_MODE','development')]
 for mode in modes:
  tag=name+'-'+mode;env={**os.environ,**extra,'SOLAR_ANIMATION_REACT_MODE':mode,'SOLAR_ANIMATION_REPORT_DIR':str(out/tag)}
  with open(out/(tag+'.log'),'w') as f: code=subprocess.call(['node','scripts/verify-solar-animation-browser.mjs'],cwd=portal,env=env,stdout=f,stderr=subprocess.STDOUT)
  rows.append({'name':tag,'exit':code}); print(tag,code,flush=True);(out/'browser-results.json').write_text(json.dumps(rows,indent=2))
  if code:raise SystemExit(code)
