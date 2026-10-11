from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
for name in ('source-terminal','source-verified'):
 assert json.loads((p/(name+'.json')).read_text())==json.loads((p/'source-before.json').read_text())
for directory,manifest in [('built','built-sha256.json'),('compiled','compiled-sha256.json')]:
 entries=json.loads((p/manifest).read_text())
 for name,digest in entries.items():
  assert hashlib.sha256((p/directory/name).read_bytes()).hexdigest()==digest,name
results=json.loads((p/'integration-results.json').read_text())
assert results['numPassedTests']==47 and results['numFailedTests']==0
assert results['numPassedTestSuites']==2
assert '1761 passed, 1761 total' in (p/'backend-unit-final.log').read_text()
assert len((p/'build-cohort.log').read_text().splitlines())==7
assert all(json.loads((p/'closed-ports.json').read_text()).values())
cleanup=json.loads((p/'cleanup.json').read_text())
assert cleanup['allAbsent']
assert all(not Path(name).exists() for key in ('buildRoots','emulatorTemporaryRoots') for name in cleanup[key])
print('Receipt proof evidence verified: 47 SDK cases, 1761 unit cases, seven builds, archived hashes and cleanup.')
