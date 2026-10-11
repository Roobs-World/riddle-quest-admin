from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
assert set(json.loads((p/'source-delta.json').read_text()))=={'packages/portal/src/play/pendingGuessJournal.ts','packages/portal/src/play/__tests__/pendingGuessJournal.test.ts'}
files=json.loads((p/'built-sha256.json').read_text());assert len(files)==1299
for file,digest in files.items():assert hashlib.sha256((p/'built'/file).read_bytes()).hexdigest()==digest,file
assert '2 failed, 59 passed' in (p/'unit-red.log').read_text()
assert '63 passed, 63 total' in (p/'focused-unit.log').read_text()
assert '3128 passed' in (p/'client-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cases=checks=0
for engine in ['chromium','firefox']:
 for kind in ['production','fault-production']:
  data=json.loads((p/(engine+'-'+kind+'.log')).read_text());assert not data['failures'];cases+=data['cases'];checks+=data['checks']
  rows=json.loads((p/(engine+'-'+kind)/'observations.json').read_text());assert len(rows)==data['checks']
  for row in rows:assert row['actual']==row['expected'],row
  if kind=='fault-production':
   for name in ['failed renewal does not retransmit a queued command','failed renewal retains its durable request','successful renewal retransmits the same durable request','successful renewal posts exactly one retry']:assert sum(row['name']==name for row in rows)==2
assert (cases,checks)==(20,172)
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6 and not Path(cleanup['buildRoot']).exists()
print('Verified exact lease renewal: two red regressions, 3128 client tests, 20 production browser journeys / 172 assertions, seven isolated builds and cleanup.')
