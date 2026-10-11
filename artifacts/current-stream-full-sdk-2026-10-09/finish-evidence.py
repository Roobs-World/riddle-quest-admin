from pathlib import Path
import hashlib,json,shutil
r=Path.cwd();e=r/'artifacts/current-stream-full-sdk-2026-10-09'
result=json.loads((e/'integration-results.json').read_text())
assert result['success'] and result['numFailedTests']==0 and result['numFailedTestSuites']==0
baseline=json.loads((e/'source-before.json').read_text())
current={name:hashlib.sha256((r/name).read_bytes()).hexdigest() for name in baseline}
assert current==baseline
(e/'source-terminal.json').write_text(json.dumps(current,indent=2)+'\n')
compiled=Path('/tmp/current-stream-full-sdk-compiled-20261009a')
assert compiled.is_dir()
files=[p for p in compiled.rglob('*') if p.is_file() and 'node_modules' not in p.parts]
manifest={str(p.relative_to(compiled)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
for p in files:
 destination=e/'compiled'/p.relative_to(compiled);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,destination)
(e/'compiled-sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'suites':result['numPassedTestSuites'],'tests':result['numPassedTests'],'pendingTests':result['numPendingTests'],'sourceInputs':len(current),'compiledFiles':len(manifest)},indent=2))
