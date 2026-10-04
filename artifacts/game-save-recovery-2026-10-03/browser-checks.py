import subprocess,os,json
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent;rows=[]
for name,extra in [('production',{'SAVE_RECOVERY_REACT_MODE':'production'}),('baseline',{'SAVE_RECOVERY_BASELINE_DIR':str(out)})]:
 with (out/(name+'.log')).open('w') as f:code=subprocess.call(['pnpm','--filter','@qwordly/portal','exec','node','scripts/verify-game-save-recovery-browser.mjs'],cwd=root,env={**os.environ,'pnpm_config_verify_deps_before_run':'false','SAVE_RECOVERY_REPORT_DIR':str(out/name),**extra},stdout=f,stderr=subprocess.STDOUT)
 rows.append({'name':name,'exit':code});print(name,code,flush=True);(out/'browser-results.json').write_text(json.dumps(rows,indent=2))
 if code:raise SystemExit(code)
