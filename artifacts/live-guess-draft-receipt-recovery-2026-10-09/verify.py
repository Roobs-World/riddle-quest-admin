from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text())
assert all(json.loads((p/(name+'.json')).read_text())==before for name in ['source-terminal','source-verified'])
files=json.loads((p/'built-sha256.json').read_text());assert len(files)==1299
for name,digest in files.items():assert hashlib.sha256((p/'built'/name).read_bytes()).hexdigest()==digest,name
assert '3118 passed' in (p/'client-unit.log').read_text()
assert '1769 passed, 1769 total' in (p/'backend-unit.log').read_text()
assert '60 passed, 60 total' in (p/'focused-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
assert '22 passed, 22 total' in (p/'rendered.log').read_text()
assert '1 passed, 1 total' in (p/'facebook-rendered.log').read_text()
journeys=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  reports=[p/f'{engine}-{mode}-final.log']+[p/f'{engine}-{mode}-compatibility-{probe}.log' for probe in ['reload','boundary','writer','storage','poll']]
  for file in reports:
   data=json.loads(file.read_text().strip().splitlines()[-1]);journeys+=data['journeys'];checks+=data['checks']
for folder in [p,p/'compatibility']:
 for file in folder.rglob('observations.json'):
  for row in json.loads(file.read_text()):assert row['actual']==row['expected'],(file,row)
assert journeys==176 and checks==1224,(journeys,checks)
native=json.loads((p/'firefox-mcp-proof.json').read_text());a,b=native['before'],native['after']
assert a['checkpoint']['guessReceipt']['requestId']==b['lookups'][0]['requestId']
assert a['accepted']==2 and json.loads(a['checkpoint']['binding'])[-1]==1
assert b['letters']==['t','e','',''] and len(b['lookups'])==1
assert 'guessReceipt' not in b['checkpoint'] and json.loads(b['checkpoint']['binding'])[-1]==2
assert not b['commands'] and not b['errors'] and not b['unhandled']
assert 'Firefox/157.0' in b['userAgent']
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent']
assert all(not Path(cleanup[key]).exists() for key in ['buildRoot','facebookFixture','externalFixture'])
assert all(json.loads((p/'external-port-closed.json').read_text()).values())
print('Verified: 176 browser journeys / 1224 checks, native Firefox receipt proof, 3118 client tests, 1769 backend tests, seven builds and 23 rendered cases.')
