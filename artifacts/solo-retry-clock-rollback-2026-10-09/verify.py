from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
assert set(json.loads((p/'source-delta.json').read_text()))=={'packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts','packages/portal/scripts/verify-journal-write-work-browser.mjs'}
files=json.loads((p/'built-sha256.json').read_text());assert len(files)==1299
for file,digest in files.items():assert hashlib.sha256((p/'built'/file).read_bytes()).hexdigest()==digest,file
rows=json.loads((p/'chromium-before'/'observations.json').read_text());failed=[row for row in rows if row['actual']!=row['expected']];assert len(failed)==2 and all(row['name']=='only current callback may renew its exact request' for row in failed)
assert '3128 passed' in (p/'client-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cases=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  raw=(p/(engine+'-'+mode+'.log')).read_text();data=json.loads(raw[raw.index('{'):]);assert not data['failures'];cases+=data['cases'];checks+=data['checks']
  rows=json.loads((p/(engine+'-'+mode)/'observations.json').read_text());assert len(rows)==data['checks']
  for row in rows:assert row['actual']==row['expected'],row
  for clock in ['rollback','forward']:assert len({(row['width'],row['scenario']) for row in rows if row['scenario'].endswith(clock)})==8
assert (cases,checks)==(64,480)
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6 and not Path(cleanup['buildRoot']).exists()
print('Verified retry-clock recovery: two pre-fix browser failures, 3128 client tests, 64 browser journeys / 480 assertions, seven isolated builds and cleanup.')
