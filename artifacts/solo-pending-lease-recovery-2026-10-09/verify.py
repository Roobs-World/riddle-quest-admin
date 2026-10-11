from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
assert set(json.loads((p/'source-delta.json').read_text()))=={'packages/portal/src/play/pendingGuessJournal.ts','packages/portal/src/play/__tests__/pendingGuessJournal.test.ts'}
files=json.loads((p/'built-sha256.json').read_text());assert len(files)==1299
for file,digest in files.items():assert hashlib.sha256((p/'built'/file).read_bytes()).hexdigest()==digest,file
assert '6 failed, 53 passed' in (p/'unit-red.log').read_text()
assert '61 passed, 61 total' in (p/'focused-unit.log').read_text()
assert '3126 passed' in (p/'client-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cases=checks=0
for engine in ['chromium','firefox']:
 data=json.loads((p/(engine+'-production.log')).read_text());assert not data['failures'];cases+=data['cases'];checks+=data['checks']
 rows=json.loads((p/(engine+'-production')/'observations.json').read_text());assert len(rows)==60
 for row in rows:assert row['actual']==row['expected'],row
 assert sum(row['name']=='only current callback may renew its exact request' for row in rows)==8
assert (cases,checks)==(16,120)
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6 and not Path(cleanup['buildRoot']).exists()
print('Verified pending lease recovery: six red regressions, 3126 client unit tests, 16 production browser journeys / 120 assertions, seven isolated builds and cleanup.')
