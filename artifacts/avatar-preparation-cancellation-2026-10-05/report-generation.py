from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/avatar-preparation-cancellation-2026-10-05'

def read(name):
    return (p / name).read_text()

expected = {'original-minimal': (22, 8), 'original-repeat': (22, 8), 'original-expanded': (286, 54), 'helper-probe': (286, 54), 'complete-probe': (286, 0), 'development': (858, 0), 'production': (858, 0), 'related-development': (420, 0), 'related-production': (420, 0)}
results = {}
for name, (checks, failures) in expected.items():
    rows = json.loads(read(name + '/observations.json'))
    results[name] = {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}
    assert results[name] == {'checks': checks, 'failures': failures}, name
before = json.loads(read('source-before-verification.json'))
after = json.loads(read('source-after-verification.json'))
assert before == after
for name, digest in after.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
captures = [('image', 'packages/portal/src/play/avatarImage.ts'), ('operations', 'packages/portal/src/play/game/hooks/useGameOperations.ts'), ('unit', 'packages/portal/src/play/__tests__/avatarImage.test.ts'), ('package', 'packages/portal/package.json')]
diff = ''
for captured, source in captures:
    assert (p / (captured + '.after.txt')).read_bytes() == (root / source).read_bytes()
    diff += ''.join(difflib.unified_diff(read(captured + '.before.txt').splitlines(True), read(captured + '.after.txt').splitlines(True), fromfile='a/' + source, tofile='b/' + source))
verifier = 'packages/portal/scripts/verify-avatar-preparation-cancellation-browser.mjs'
assert (p / 'verifier.final.mjs').read_bytes() == (root / verifier).read_bytes()
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/' + verifier))
(p / 'own.diff').write_text(diff)
units = read('portal-unit.log')
assert re.search(r'Test Suites:\s+15 skipped, 297 passed', units)
assert re.search(r'Tests:\s+93 skipped, 2761 passed', units)
assert 'error TS' not in read('portal-types.log')
doc = re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files', read('tsdoc.log'))
assert doc
targets = ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']
assert read('builds.log').splitlines() == [target + ' build passed' for target in targets]
for target in targets:
    assert 'artifact audit passed' in read('build-' + target + '.log'), target
assert re.search(r'Test Suites:\s+3 passed, 3 total', read('built-browser.log'))
assert re.search(r'Tests:\s+8 passed, 8 total', read('built-browser.log'))
firefox = json.loads(read('firefox-native.json'))
assert len(firefox) == 6
assert all(row['errors'] == row['unhandled'] == [] for row in firefox)
assert firefox[0]['sent'] == [] and firefox[0]['reads'] == 1 and firefox[0]['closed'] == 1
assert firefox[1]['sent'] == [] and all(firefox[1][key] == 0 for key in ['canvases', 'draws', 'encodes', 'reads']) and firefox[1]['closed'] == 1
assert len(firefox[2]['sent']) == 1 and firefox[2]['sent'][0]['uid'] == 'player-b' and firefox[2]['sent'][0]['webp']
assert firefox[3]['controls'] == 0 and firefox[3]['encodes'] == 1 and firefox[3]['reads'] == 0 and firefox[3]['closed'] == 1 and firefox[3]['sent'] == []
assert len(firefox[4]['sent']) == 1 and firefox[4]['reads'] == 1 and firefox[4]['closed'] == 2 and firefox[4]['sent'][0]['webp']
assert firefox[5]['rejected'] == ['invalid-avatar-file'] and len(firefox[5]['sent']) == 1
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:avatar-preparation-cancellation:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'AVATAR_CANCEL_REACT_MODE=production' in manifest['scripts']['test:avatar-preparation-cancellation:browser']
build_hashes = {str(f.relative_to(p / 'built')): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((p / 'built').rglob('*')) if f.is_file()}
assert build_hashes == json.loads(read('built-sha256.json'))
assert not Path(read('build-root.txt')).exists()
summary = {'comparisons': results, 'focusedBrowserAssertions': 1716, 'relatedBrowserAssertions': 840, 'browserAssertionsTotal': 2556, 'focusedJourneys': 78, 'viewports': [[390, 568], [390, 844], [1280, 844]], 'builtBrowser': {'suites': 3, 'tests': 8, 'failures': 0, 'latencyThresholdChanged': False}, 'unitTests': 2761, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'stableSourceInputs': len(after), 'sourceDelta': [], 'firefoxRecords': len(firefox), 'preservedBuildFiles': len(build_hashes), 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
