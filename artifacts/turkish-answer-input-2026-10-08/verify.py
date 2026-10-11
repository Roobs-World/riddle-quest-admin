from pathlib import Path
import json,hashlib,subprocess
r=Path.cwd();e=r/'artifacts/turkish-answer-input-2026-10-08';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-verified'],check=True);subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==13
for row in owned:
 assert sha(r/row['path'])==row['afterSha256']==sha(e/'owned-after'/row['path'])
 if row['before']:assert sha(r/row['before'])==row['beforeSha256']
journeys=0
for name in ['permanent/development','permanent/production','firefox-development','firefox-production']:
 rows=json.loads((e/name/'observations.json').read_text());assert len(rows)==8
 for row in rows:assert row['draft']=='İZMİR' and row['guess']=='İZMİR' and row['greenLetters']==5 and row['browserErrors']==[]
 journeys+=len(rows)
checks=0
for suite in ['commit','render']:
 for mode in ['development','production']:
  rows=json.loads((e/f'{suite}-{mode}/observations.json').read_text());rows=[x for x in rows if not x.get('diagnostic')];assert all(x['actual']==x['expected'] for x in rows);checks+=len(rows)
for name,needle in [('red-unit-client.log','4 failed, 79 passed'),('red-unit-server.log','1 failed, 26 passed'),('full-tests-client.log','2997 passed'),('full-tests-server.log','1759 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed')]:assert needle in (e/name).read_text(),name
assert 'v22.23.1' in (e/'static-runtime.log').read_text()
assert '$ tsc -p tsconfig.json --noEmit' in (e/'types-server.log').read_text() and '$ eslint --ext .js,.ts src' in (e/'lint-server.log').read_text()
assert all(x+' build passed' in (e/'build-cohort.log').read_text() for x in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1299
for name,h in hashes.items():assert sha(e/'built'/name)==h
clean=json.loads((e/'cleanup.json').read_text());assert clean['allAbsent'] and len(clean['metadata'])==7;assert all(not Path(p).exists() for p in clean['buildRoots']) and all(not (r/p).exists() for p in clean['metadata'])
old=json.loads((r/'artifacts/live-safety-focus-2026-10-08/source-terminal.json').read_text());new=json.loads((e/'source-terminal.json').read_text());assert {p for p in set(old)|set(new) if old.get(p)!=new.get(p)}=={row['path'] for row in owned}
summary={'sourceInputs':len(new),'ownedInputs':len(owned),'clientTests':2997,'backendTests':1759,'backendRuntime':'Node22.23.1','turkishBrowserJourneys':journeys,'adjacentBrowserAssertions':checks,'builtBrowserChecks':23,'targetBuilds':6,'devvitBuilt':True,'builtFiles':len(hashes),'deployed':False,'historicalHintReceiptsRewritten':False,'goalComplete':False,'terminalSessions':{'44177':1,'73863':1,'37138':0,'63074':0,'24691':0,'3125':0,'81099':0,'24910':0,'57707':0}}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
