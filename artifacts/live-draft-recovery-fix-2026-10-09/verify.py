import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((root/'source-before.json').read_text())
assert len(source)==2506 and source==json.loads((root/'source-terminal.json').read_text())==json.loads((root/'source-verified.json').read_text())
assert all(sha(Path(name))==digest for name,digest in source.items())
journeys=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  for suffix,expected in [('',2),('-boundaries',12)]:
   prefix=engine+'-'+mode+suffix
   rows=json.loads((root/prefix/'observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   count=len({(row['width'],row.get('scenario','same')) for row in rows});assert count==expected
   journeys+=count;checks+=len(rows)
assert journeys==56 and checks==304
red=json.loads((root/'chromium-development-baseline/observations.json').read_text())
failures=[row for row in red if row['actual']!=row['expected']]
assert len(failures)==1 and failures[0]['actual']==['','','',''] and failures[0]['expected']==['t','e','','']
old=json.loads((Path('artifacts/live-draft-recovery-audit-2026-10-09')/'source-observed.json').read_text())
assert sha(root/'LiveRaceGame.before.tsx')==old['packages/portal/src/play/race/LiveRaceGame.tsx']
for name,text in [('unit.log','32 passed'),('full-client.log','3084 passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed'),('tsdoc-final.log','TSDoc audit passed'),('file-sizes-final.log','Maintainable-file size audit passed')]:assert text in (root/name).read_text(),name
for target in ['jest','facebook','reddit','youtube','netflix','yahoo','reddit-server']:assert 'built in' in (root/('build-'+target+'.log')).read_text(),target
hashes=json.loads((root/'built-sha256.json').read_text());assert len(hashes)==1299
assert all(sha(root/'built'/name)==digest for name,digest in hashes.items())
cleanup=json.loads((root/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
assert all(not Path(name).exists() for name in cleanup['metadata']+cleanup['buildRoots'])
assert json.loads((root/'processes.json').read_text())=={'51944':0,'15968':0,'54583':0,'96061':0,'4358':0,'32088':0,'54546':1}
print('Verified: 3084 client tests, 56 injected journeys / 304 checks, 23 built checks, six targets, source freeze and owned cleanup.')
