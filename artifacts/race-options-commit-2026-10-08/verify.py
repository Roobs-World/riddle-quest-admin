from pathlib import Path
import json,hashlib,subprocess
r=Path.cwd();e=r/'artifacts/race-options-commit-2026-10-08';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-verified'],check=True)
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
owned=json.loads((e/'owned-files.json').read_text())
for row in owned:assert sha(r/row['path'])==row['afterSha256']==sha(e/'owned-after'/row['path'])
for mode in ['development','production']:
 rows=json.loads((e/'permanent'/('observations-'+mode+'.json')).read_text());assert len(rows)==2 and all(x['actual']==x['expected'] for x in rows)
red=json.loads((e/'permanent-red/observations-production.json').read_text());assert red[0]['actual']=='speculative' and red[0]['expected']=='original'
assert '2992 passed' in (e/'full-tests.log').read_text()
assert 'TSDoc audit passed' in (e/'tsdoc.log').read_text()
assert 'Maintainable-file size audit passed' in (e/'file-sizes.log').read_text()
assert '22 passed' in (e/'built-browser.log').read_text() and '1 passed' in (e/'facebook-browser.log').read_text()
cohort=(e/'build-cohort.log').read_text();assert all(x+' build passed' in cohort for x in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
assert (e/'resources-browser.log').read_text().count('Browser resource ownership passed:')==8
assert 'element is not enabled' in (e/'tick-browser.log').read_text()
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1299
for name,h in hashes.items():assert sha(e/'built'/name)==h
cleanup=json.loads((e/'cleanup.json').read_text());assert cleanup['allAbsent'] and all(not Path(x).exists() for x in cleanup['buildRoots']) and all(not (r/x).exists() for x in cleanup['metadata'])
old=json.loads((r/'artifacts/backend-reliability-2026-10-08/source-terminal.json').read_text());new=json.loads((e/'source-terminal.json').read_text());changed={p for p in set(old)|set(new) if old.get(p)!=new.get(p)};assert changed=={x['path'] for x in owned}
summary={'ownedInputs':len(owned),'sourceInputs':len(new),'unitTests':2992,'permanentBrowserAssertions':4,'resourceMatrices':8,'builtBrowserTests':23,'buildTargets':6,'devvitServerBuilt':True,'builtFiles':len(hashes),'inventories':7,'obsoleteClockFixturePassed':False,'currentProductionCallerForHook':False,'productionDeployment':False,'goalComplete':False,'terminalSessions':{'43350':0,'80187':0,'90454':0,'3803':0,'72708':1,'68543':0}}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
