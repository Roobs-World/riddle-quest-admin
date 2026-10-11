from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
behavior=json.loads((p/'source-before-behavior.json').read_text());assert behavior==json.loads((p/'source-terminal-behavior.json').read_text())
assert [name for name,digest in before.items() if behavior.get(name)!=digest]==['firebase-functions/src/__tests__/race/raceLiveSignals.it.test.ts']
assert len(json.loads((p/'source-delta.json').read_text()))==2
for name,count in [('built',1299),('compiled',398)]:
 files=json.loads((p/(name+'-sha256.json')).read_text());assert len(files)==count
 for file,digest in files.items():assert hashlib.sha256((p/name/file).read_bytes()).hexdigest()==digest,file
red=json.loads((p/'integration-red-results.json').read_text());assert red['numFailedTests']==2 and red['numPassedTests']==6
result=json.loads((p/'integration-results.json').read_text());assert result['success'] and result['numPassedTests']==12 and result['numPassedTestSuites']==1
assert '1769 passed, 1769 total' in (p/'backend-unit.log').read_text()
assert '22 passed, 22 total' in (p/'client-stream-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6
for key in ['buildRoot','compiledRoot','emulatorTemporary','redEmulatorTemporary']:assert not Path(cleanup[key]).exists()
assert (p/'red-emulator-temporary').is_dir()
assert all(json.loads((p/'ports-closed.json').read_text()).values())
print('Verified stream retention: 12 actual SDK tests, 1769 backend unit tests, 22 client stream tests, seven isolated builds and cleanup.')
