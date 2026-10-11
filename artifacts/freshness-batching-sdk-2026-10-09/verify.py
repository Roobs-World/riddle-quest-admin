import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
source=json.loads((root/'source-before.json').read_text())
assert all(Path(name).is_file() and hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest for name,digest in source.items()), 'Source changed'
import re
log=(root/'run.log').read_text()
assert 'Error: An unexpected error has occurred.' in log and not re.search(r'^FAIL ',log,re.M)
passed=re.findall(r'^PASS (\S+)',log,re.M)
assert len(passed)==len(set(passed))==87
expected={str(Path(name).resolve()) for name in json.loads((root/'integration-selection.json').read_text())}
results=json.loads((root/'storage-recovery/integration-results.json').read_text())
assert results['success'] and results['numFailedTests']==0 and results['numPendingTests']==0
actual={str((Path('firebase-functions')/name).resolve()) for name in passed}
actual.update(row['name'] for row in results['testResults'])
assert expected==actual and len(expected)==88
assert len(results['testResults'])==1 and results['testResults'][0]['status']=='passed'
cleanup=json.loads((root/'cleanup.json').read_text())
assert cleanup['allClosed'] and cleanup['compiledOutputRemoved']
assert not Path('/tmp/freshness-batching-sdk-compiled-20261009a').exists()
print('87 logged passing SDK suites plus recovered Storage suite (2 tests); frozen sources and cleanup verified.')
