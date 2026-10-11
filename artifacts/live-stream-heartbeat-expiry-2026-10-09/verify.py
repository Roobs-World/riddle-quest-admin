from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
before=json.loads((p/'source-before.json').read_text());assert len(before)==2525
for name in ['source-terminal','source-verified']:assert json.loads((p/(name+'.json')).read_text())==before
assert len(json.loads((p/'source-delta.json').read_text()))==2
for name,count in [('built',1299),('compiled',398)]:
 files=json.loads((p/(name+'-sha256.json')).read_text());assert len(files)==count
 for file,digest in files.items():assert hashlib.sha256((p/name/file).read_bytes()).hexdigest()==digest,file
red=json.loads((p/'integration-red-results.json').read_text());assert red['numFailedTests']==1 and red['numPassedTests']==12
assert 'Expired notification stayed healthy' in (p/'sdk-red.log').read_text()
result=json.loads((p/'integration-results.json').read_text());assert result['success'] and result['numPassedTests']==13 and result['numPassedTestSuites']==1
case=[test for suite in result['testResults'] for test in suite['assertionResults'] if 'once its deadline expires without another snapshot' in test['fullName']];assert len(case)==1 and case[0]['status']=='passed'
assert '1769 passed, 1769 total' in (p/'backend-unit.log').read_text()
assert '25 passed, 25 total' in (p/'client-stream-unit.log').read_text()
assert 'TSDoc audit passed' in (p/'tsdoc.log').read_text()
assert 'size audit passed' in (p/'file-sizes.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
cleanup=json.loads((p/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6
for key in ['buildRoot','compiledRoot','emulatorTemporary','redEmulatorTemporary']:assert not Path(cleanup[key]).exists()
assert (p/'red-emulator-temporary').is_dir()
assert all(json.loads((p/'ports-closed.json').read_text()).values())
print('Verified heartbeat expiry: 13 actual SDK tests, 1769 backend unit tests, 25 client stream tests, seven isolated builds and cleanup.')
