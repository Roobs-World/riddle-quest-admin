import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((root/'source-before.json').read_text())
assert len(source)==2504 and source==json.loads((root/'source-terminal.json').read_text())==json.loads((root/'source-verified.json').read_text())
assert all(Path(name).is_file() and sha(Path(name))==digest for name,digest in source.items())
assert len(json.loads((root/'owned-inputs.json').read_text()))==5
cases=checks=0
for browser in ['chromium','firefox']:
 for mode in ['development','production']:
  for prefix in ['', 'lifetime-']:
   rows=json.loads((root/f'{prefix}{browser}-{mode}/observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   cases+=len({(row['width'],row['height'],row['scenario']) for row in rows});checks+=len(rows)
  trace=json.loads((root/f'{browser}-{mode}/storage-trace.json').read_text())
  for row in trace:
   operation=row['scenario'].split(':')[2]
   assert len(row['trace'])==({'guess':5,'hint':2,'continue':1,'skip':1}[operation])
   if operation=='guess':assert json.loads(row['trace'][-1])['draft']==['C','A','N','','']
assert cases==480 and checks==3688
red=json.loads((root/'baseline/observations.json').read_text())
failures=[row for row in red if row['actual']!=row['expected']]
assert len(failures)==2 and all(':continue:' in row['scenario'] and row['actual']==2 and row['expected']==1 for row in failures)
for name,needle in [('unit.log','53 passed'),('full-tests.log','3071 passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed')]:
 assert needle in (root/name).read_text(),name
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:
 assert target+' build passed' in (root/'build-cohort.log').read_text()
assert 'Devvit server build passed' in (root/'build-cohort.log').read_text()
hashes=json.loads((root/'built-sha256.json').read_text());assert len(hashes)==1299
assert all(sha(root/'built'/name)==digest for name,digest in hashes.items())
cleanup=json.loads((root/'cleanup.json').read_text())
assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
assert all(not Path(name).exists() for name in cleanup['metadata']+cleanup['buildRoots'])
print('Failure-safe journal deduplication: 3071 units, 480 browser journeys, 23 built checks, six targets and cleanup verified.')
