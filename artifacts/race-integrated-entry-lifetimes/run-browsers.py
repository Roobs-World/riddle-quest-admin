import concurrent.futures,json,subprocess,time
from pathlib import Path
out=Path('artifacts/race-integrated-entry-lifetimes')
checks=[c for c in json.loads(Path('docs/development-tasks/race-provider-start-selection.json').read_text())['checks'] if any('verify-race-' in s and s.endswith('.mjs') for s in c['args'])]
def run(c):
 start=time.monotonic()
 with (out/(c['id']+'.log')).open('w') as log:
  result=subprocess.run([c['executable'],*c['args']],stdout=log,stderr=subprocess.STDOUT)
 return {'id':c['id'],'exitCode':result.returncode,'durationSeconds':round(time.monotonic()-start,2),'command':[c['executable'],*c['args']]}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for f in concurrent.futures.as_completed([pool.submit(run,c) for c in checks]):
  r=f.result();results.append(r);(out/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n');print(str(len(results))+'/'+str(len(checks))+' '+r['id']+' exit='+str(r['exitCode']),flush=True)
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
