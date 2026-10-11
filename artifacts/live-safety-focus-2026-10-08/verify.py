from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();e=r/'artifacts/live-safety-focus-2026-10-08';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-verified'],check=True);subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==4
for row in owned:assert sha(r/row['path'])==row['afterSha256']==sha(e/'owned-after'/row['path'])
checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  for width,height in [(390,568),(390,844),(1280,844)]:
   rows=json.loads((e/f'matrix-{engine}-{mode}-{width}-{height}'/'observations.json').read_text());assert len(rows)==3 and all(x['actual']==x['expected'] for x in rows);checks+=len(rows)
for mode in ['development','production']:
 rows=json.loads((e/f'tab-{mode}'/'observations.json').read_text());assert len(rows)==108 and all(x['actual']==x['expected'] for x in rows);checks+=len(rows)
red=json.loads((e/'permanent-red/observations.json').read_text());assert [x['actual'] for x in red]==[False,False,True]
for name,needle in [('full-tests.log','2993 passed'),('types.log','tsc -p tsconfig.json --noEmit'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed')]:assert needle in (e/name).read_text(),name
assert 'checkVisibility is not a function' in (e/'full-tests-initial.log').read_text()
assert all(x+' build passed' in (e/'build-cohort.log').read_text() for x in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1299
for name,h in hashes.items():assert sha(e/'built'/name)==h
clean=json.loads((e/'cleanup.json').read_text());assert len(clean['metadata'])==13 and clean['allAbsent'];assert all(not Path(x).exists() for x in clean['buildRoots']) and all(not (r/x).exists() for x in clean['metadata'])
old=json.loads((r/'artifacts/race-options-commit-2026-10-08/source-terminal.json').read_text());new=json.loads((e/'source-terminal.json').read_text());assert {p for p in set(old)|set(new) if old.get(p)!=new.get(p)}=={x['path'] for x in owned}
summary={'sourceInputs':len(new),'ownedInputs':4,'unitTests':2993,'currentSurfaceBrowserAssertions':checks,'builtBrowserTests':23,'builtFiles':len(hashes),'targetBuilds':6,'devvitBuilt':True,'inventories':13,'pointerOverlapWasFixtureOmission':True,'deployed':False,'goalComplete':False,'terminalSessions':{'14424':0,'1185':0,'92257':0,'34426':1,'12006':0,'17184':0,'13081':0,'39651':0,'32111':0}}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
