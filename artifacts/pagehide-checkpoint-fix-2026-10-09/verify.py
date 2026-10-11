import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
final=json.loads((root/'source-final.json').read_text())
assert len(final)==2503
assert all(Path(name).is_file() and sha(Path(name))==digest for name,digest in final.items())
tested=json.loads((root/'source-before.json').read_text())
assert tested==json.loads((root/'source-terminal.json').read_text())==json.loads((root/'source-verified.json').read_text())
harness='packages/portal/scripts/verify-checkpoint-commit-browser.mjs'
assert [name for name in tested if tested[name]!=final[name]]==[harness]
old=(root/'browser-harness.tested.mjs').read_text()
assert sha(root/'browser-harness.tested.mjs')==tested[harness]
assert '\n'.join(line.rstrip() for line in old.splitlines())+'\n'==Path(harness).read_text()
reuse=json.loads((root/'build-source-reuse.json').read_text())
assert reuse['productionInputsUnchanged'] and reuse['changedInputs']==['packages/portal/src/play/__tests__/confirmedGuessPersistence.test.ts']
cases=checks=0
for browser in ['chromium','firefox']:
 for mode in ['development','production']:
  for lifecycle in ['visibility','pagehide','both']:
   rows=json.loads((root/f'{browser}-{mode}-{lifecycle}/observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   checks+=len(rows);cases+=len({(row['width'],row['height'],row['scenario']) for row in rows})
assert cases==360 and checks==2340
red=json.loads((root/'baseline/observations.json').read_text())
failures=[row for row in red if row['actual']!=row['expected']]
assert len(failures)==1 and failures[0]['actual']==[] and failures[0]['expected'][0]['draft']=='PIANO'
rows=json.loads((root/'final-format-check/observations.json').read_text())
assert all(row['actual']==row['expected'] for row in rows)
for name,needle in [('full-tests-final.log','3068 passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed'),('tsdoc-final.log','TSDoc audit passed'),('file-sizes-final.log','Maintainable-file size audit passed')]:
 assert needle in (root/name).read_text(),name
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:
 assert target+' build passed' in (root/'build-cohort.log').read_text()
assert 'Devvit server build passed' in (root/'build-cohort.log').read_text()
built=json.loads((root/'built-sha256.json').read_text());assert len(built)==1299
assert all(sha(root/'built'/name)==digest for name,digest in built.items())
cleanup=json.loads((root/'cleanup.json').read_text())
assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
assert all(not Path(name).exists() for name in cleanup['metadata']+cleanup['buildRoots'])
print('Pagehide checkpoint fix: 3068 units, 360 lifecycle journeys, 23 built checks, six artifacts and cleanup verified.')
