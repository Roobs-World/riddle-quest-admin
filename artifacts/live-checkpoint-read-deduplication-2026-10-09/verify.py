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
  for suffix,expected in [('',2),('-boundaries',12),('-writer',2),('-storage',4),('-poll',2)]:
   prefix=engine+'-'+mode+suffix
   rows=json.loads((root/prefix/'observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   count=len({(row['width'],row.get('scenario','same')) for row in rows});assert count==expected
   journeys+=count;checks+=len(rows)
assert journeys==88 and checks==520
assert '1 failed, 17 passed' in (root/'baseline-unit.log').read_text()
old=json.loads((Path('artifacts/live-draft-storage-recovery-2026-10-09')/'source-before.json').read_text())
assert sha(root/'liveRaceDraftStorage.before.ts')==old['packages/portal/src/play/race/logic/liveRaceDraftStorage.ts']
for name,text in [('unit.log','37 passed'),('full-client.log','3089 passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed')]:assert text in (root/name).read_text(),name
for target in ['jest','facebook','reddit','youtube','netflix','yahoo','reddit-server']:assert 'built in' in (root/('build-'+target+'.log')).read_text(),target
hashes=json.loads((root/'built-sha256.json').read_text());assert len(hashes)==1299
assert all(sha(root/'built'/name)==digest for name,digest in hashes.items())
cleanup=json.loads((root/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
assert all(not Path(name).exists() for name in cleanup['metadata']+cleanup['buildRoots'])
assert all(code==0 for code in json.loads((root/'processes.json').read_text()).values())
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  rows=json.loads((root/f'{engine}-{mode}-poll/observations.json').read_text())
  work=[row for row in rows if row['name']=='observed storage work during five requested refreshes']
  assert len(work)==2 and all(row['actual']=={'reads':0,'writes':0,'removes':0} for row in work)
print('Verified: 3089 client tests, 88 browser journeys / 520 checks, 23 built checks, six targets; unchanged poll storage reads reduced from 40 to zero.')
