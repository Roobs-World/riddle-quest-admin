from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/avatar-preparation-ownership-2026-10-05'

def read(name):
    return (p / name).read_text()

def observations(name):
    rows = json.loads(read(name + '/observations.json'))
    return {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}

expected = {'original-minimal': (28, 3), 'original-repeat': (28, 2), 'original-expanded': (140, 13), 'scope-probe': (140, 3), 'selection-probe': (140, 1), 'complete-probe': (140, 0), 'development': (420, 0), 'production': (420, 0)}
results = {name: observations(name) for name in expected}
for name, (checks, failures) in expected.items():
    assert results[name] == {'checks': checks, 'failures': failures}, name
before = json.loads(read('source-before-verification.json'))
after = json.loads(read('source-after-verification.json'))
assert before == after
for name, digest in after.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
for captured, source in [('operations.after.txt', 'packages/portal/src/play/game/hooks/useGameOperations.ts'), ('package.after.txt', 'packages/portal/package.json'), ('verifier.final.mjs', 'packages/portal/scripts/verify-avatar-preparation-ownership-browser.mjs'), ('leaderboard-verifier.mjs', 'packages/portal/scripts/verify-leaderboard-request-browser.mjs')]:
    assert (p / captured).read_bytes() == (root / source).read_bytes(), source
units = read('portal-unit.log')
assert re.search(r'Test Suites:\s+15 skipped, 297 passed', units)
assert re.search(r'Tests:\s+93 skipped, 2758 passed', units)
assert 'error TS' not in read('portal-types.log')
doc = re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files', read('tsdoc.log'))
assert doc
targets = ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']
assert read('builds.log').splitlines() == [target + ' build passed' for target in targets]
for target in targets:
    assert 'artifact audit passed' in read('build-' + target + '.log'), target
browser = read('built-browser.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total', browser)
assert re.search(r'Tests:\s+8 passed, 8 total', browser)
for width in [320, 1280]:
    assert f'xp at {width}px: 9 requests' in read('leaderboard.log')
firefox = json.loads(read('firefox-native.json'))
assert len(firefox) == 8
assert firefox[0]['owner']['uid'] == 'player-b' and len(firefox[0]['sent']) == 1
assert firefox[1]['owner']['uid'] == 'player-b' and len(firefox[1]['sent']) == 0
assert len(firefox[2]['sent']) == 1 and firefox[2]['sent'][0]['uid'] == 'player-b' and firefox[2]['sent'][0]['webp'] is True
assert firefox[3]['sentCount'] == 1 and firefox[4]['sentCount'] == 2
assert firefox[5]['controls'] == 0 and firefox[5]['sentCount'] == 2
assert firefox[6]['owner']['accountGeneration'] == 2 and firefox[6]['rejected'] == [] and firefox[6]['sentCount'] == 2
assert firefox[7]['rejected'] == ['invalid-avatar-file'] and firefox[7]['sentCount'] == 2
assert all(row['errors'] == row['unhandled'] == [] for row in firefox)
assert all(row['closed'] == row['completed'] for row in firefox[:7])
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:avatar-preparation-ownership:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'AVATAR_OWNER_REACT_MODE=production' in manifest['scripts']['test:avatar-preparation-ownership:browser']
diff = ''
for a, b, name in [('operations.before.txt', 'operations.after.txt', 'packages/portal/src/play/game/hooks/useGameOperations.ts'), ('package.before.txt', 'package.after.txt', 'packages/portal/package.json')]:
    diff += ''.join(difflib.unified_diff(read(a).splitlines(True), read(b).splitlines(True), fromfile='a/' + name, tofile='b/' + name))
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/packages/portal/scripts/verify-avatar-preparation-ownership-browser.mjs'))
(p / 'own.diff').write_text(diff)
summary = {'comparisons': results, 'focusedBrowserAssertions': 840, 'focusedJourneys': 60, 'viewports': [[390, 568], [390, 844], [1280, 844]], 'builtBrowser': {'suites': 3, 'tests': 8, 'failures': 0, 'latencyThresholdChanged': False}, 'relatedCompiledLeaderboard': {'passed': True, 'viewports': [320, 1280]}, 'unitTests': 2758, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'stableSourceInputs': len(after), 'sourceDelta': [], 'firefoxRecords': len(firefox), 'initialAssertionAdjustment': 'Invalid-file control now compares the before/after request count instead of counting an earlier stale send as a validation failure.', 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
