import subprocess,json,os
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent;rows=[]
checks=[('types',['pnpm','--filter','@qwordly/portal','check:types']),('tsdoc',['pnpm','check:tsdoc']),('file-sizes',['pnpm','check:file-sizes']),('portal-tests',['pnpm','--filter','@qwordly/portal','test','--runInBand'])]+[('build-'+target,['pnpm','--filter','@qwordly/portal','build:'+target]) for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
for name,command in checks:
 with (out/(name+'.log')).open('w') as f:code=subprocess.call(command,cwd=root,env={**os.environ,'pnpm_config_verify_deps_before_run':'false'},stdout=f,stderr=subprocess.STDOUT)
 rows.append({'name':name,'exit':code});print(name,code,flush=True);(out/'verification-results.json').write_text(json.dumps(rows,indent=2))
 if code:raise SystemExit(code)
