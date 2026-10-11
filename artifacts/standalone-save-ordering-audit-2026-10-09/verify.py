from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
assert set(json.loads((p/'source-delta.json').read_text()))=={'packages/portal/src/youtube/__tests__/YouTubeSaveGate.test.ts'}
files=json.loads((p/'built-sha256.json').read_text());assert len(files)==1299
for file,digest in files.items():assert hashlib.sha256((p/'built'/file).read_bytes()).hexdigest()==digest,file
assert '76 passed, 76 total' in (p/'focused-unit.log').read_text()
assert '3129 passed' in (p/'client-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6 and not Path(cleanup['buildRoot']).exists()
print('Verified save ordering audit: new held-response regression, 76 focused tests, 3129 client tests, seven isolated builds, unchanged production and cleanup.')
