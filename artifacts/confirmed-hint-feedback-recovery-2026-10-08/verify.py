from pathlib import Path
import json,hashlib,subprocess
r=Path.cwd();e=r/'artifacts/confirmed-hint-feedback-recovery-2026-10-08';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-verified'],check=True)
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==3
for row in owned:assert sha(r/row['path'])==row['afterSha256']==sha(e/'owned-after'/row['path']) and sha(r/row['before'])==row['beforeSha256']
journeys=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  rows=json.loads((e/f'{engine}-{mode}'/'observations.json').read_text());assert len(rows)==18
  for row in rows:assert row['draft']==row['guess']=='İZMİR' and row['greenLetters']==5 and row['browserErrors']==[]
  assert sum(row['hint']=='paid' for row in rows)==6
  journeys+=len(rows)
for name,needle in [('red-browser.log',"'key' !== 'key green'"),('red-unit.log','5 failed, 89 passed'),('full-tests.log','3010 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed')]:assert needle in (e/name).read_text(),name
assert all(x+' build passed' in (e/'build-cohort.log').read_text() for x in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1299
for name,h in hashes.items():assert sha(e/'built'/name)==h
clean=json.loads((e/'cleanup.json').read_text());assert clean['allAbsent'] and len(clean['metadata'])==7;assert all(not Path(p).exists() for p in clean['buildRoots']) and all(not (r/p).exists() for p in clean['metadata'])
old=json.loads((r/'artifacts/turkish-hint-feedback-2026-10-08/source-terminal.json').read_text());new=json.loads((e/'source-terminal.json').read_text());assert {p for p in old.keys()|new.keys() if old.get(p)!=new.get(p)}=={row['path'] for row in owned}
summary=dict(sourceInputs=len(new),ownedInputs=3,clientTests=3010,turkishBrowserJourneys=journeys,builtBrowserChecks=23,targetBuilds=6,devvitBuilt=True,builtFiles=len(hashes),deployed=False,historicalHintReceiptsRewritten=False,goalComplete=False)
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
