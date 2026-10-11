from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text())
assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
for name,count in [('built',1299),('compiled',398)]:
 files=json.loads((p/(name+'-sha256.json')).read_text());assert len(files)==count
 for file,digest in files.items():assert hashlib.sha256((p/name/file).read_bytes()).hexdigest()==digest,file
assert '3120 passed' in (p/'client-unit.log').read_text()
assert '1769 passed, 1769 total' in (p/'backend-unit.log').read_text()
assert '62 passed, 62 total' in (p/'focused-unit-final.log').read_text()
assert '2 failed, 22 passed' in (p/'client-red.log').read_text()
assert '1 failed, 33 passed' in (p/'sdk-red.log').read_text()
result=json.loads((p/'integration-results.json').read_text())
assert result['success'] and result['numPassedTests']==39 and result['numPassedTestSuites']==3
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert '22 passed, 22 total' in (p/'rendered.log').read_text()
assert '1 passed, 1 total' in (p/'facebook-rendered.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
logs=[p/f'{engine}-production-concurrency.log' for engine in ['chromium','firefox']]
logs+=[p/'chromium-production-final.log']+[p/f'chromium-production-compatibility-{name}.log' for name in ['reload','boundary','writer','storage','poll']]
journeys=checks=0
for log in logs:
 data=json.loads(log.read_text().strip().splitlines()[-1]);journeys+=data['journeys'];checks+=data['checks']
assert (journeys,checks)==(48,350),(journeys,checks)
for folder in [p/'concurrency',p/'compatibility',p/'chromium-production']:
 for file in folder.rglob('observations.json'):
  for row in json.loads(file.read_text()):assert row['actual']==row['expected'],(file,row)
for engine in ['chromium','firefox']:
 rows=json.loads((p/'concurrency'/f'{engine}-production'/'observations.json').read_text());assert len(rows)==22
 assert len([row for row in rows if row['name']=='fresh authority clears the untouched restored word' and row['actual']==['','','','']])==2
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==7
for key in ['buildRoot','compiledRoot','facebookFixture','emulatorTemporary']:assert not Path(cleanup[key]).exists()
assert all(json.loads((p/'ports-closed.json').read_text()).values())
print('Verified: concurrency fix, 48 browser journeys / 350 assertions, 3120 client tests, 1769 backend unit tests, 39 focused SDK tests, seven builds, 23 rendered checks and cleanup.')
