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
  for suffix,expected in [('',2),('-boundaries',12),('-writer',2),('-storage',4)]:
   prefix=engine+'-'+mode+suffix
   rows=json.loads((root/prefix/'observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   count=len({(row['width'],row.get('scenario','same')) for row in rows});assert count==expected
   journeys+=count;checks+=len(rows)
assert journeys==80 and checks==456
assert '1 failed, 15 passed' in (root/'baseline-unit.log').read_text()
old=json.loads((Path('artifacts/live-draft-writer-ownership-2026-10-09')/'source-before.json').read_text())
assert sha(root/'liveRaceDraftStorage.before.ts')==old['packages/portal/src/play/race/logic/liveRaceDraftStorage.ts']
for name,text in [('unit.log','35 passed'),('full-client.log','3087 passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed')]:assert text in (root/name).read_text(),name
for target in ['jest','facebook','reddit','youtube','netflix','yahoo','reddit-server']:assert 'built in' in (root/('build-'+target+'.log')).read_text(),target
hashes=json.loads((root/'built-sha256.json').read_text());assert len(hashes)==1299
assert all(sha(root/'built'/name)==digest for name,digest in hashes.items())
cleanup=json.loads((root/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
assert all(not Path(name).exists() for name in cleanup['metadata']+cleanup['buildRoots'])
assert json.loads((root/'processes.json').read_text())=={'45131':0,'2909':1,'50177':0,'41248':0,'2001':0,'24833':0,'93754':0}
first=json.loads((root/'firefox-production-boundaries.first.json').read_text())
failed=[row for row in first if row['actual']!=row['expected']]
assert len(failed)==1 and failed[0]['scenario']=='accepted' and failed[0]['actual']==['t','e','','']
print('Verified: 3087 client tests, 80 browser journeys / 456 checks, 23 built checks, six targets, source freeze and owned cleanup.')
