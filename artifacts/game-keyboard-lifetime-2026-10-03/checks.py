import subprocess,os,json
from pathlib import Path
root=Path('/home/craig-beswetherick/Documents/riddle-quest');out=root/'artifacts/game-keyboard-lifetime-2026-10-03';rows=[]
checks=[('production',{'KEYBOARD_REACT_MODE':'production'}),('baseline',{'KEYBOARD_BASELINE_DIR':str(out)})]
for name,extra in checks:
 with open(out/(name+'.log'),'w') as f:code=subprocess.call(['pnpm','--filter','@qwordly/portal','exec','node','scripts/verify-game-keyboard-lifetime-browser.mjs'],cwd=root,env={**os.environ,**extra,'KEYBOARD_REPORT_DIR':str(out/name)},stdout=f,stderr=subprocess.STDOUT)
 rows.append({'name':name,'exit':code});print(name,code,flush=True);(out/'browser-results.json').write_text(json.dumps(rows,indent=2))
 if code:raise SystemExit(code)
