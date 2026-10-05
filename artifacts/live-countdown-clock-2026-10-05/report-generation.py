from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/live-countdown-clock-2026-10-05'

def read(name):
    return (p / name).read_text()

expected = {'original-minimal': (21, 9), 'original-repeat': (21, 8), 'original-expanded': (109, 46), 'original-final': (118, 47), 'visibility-guard-probe': (109, 38), 'visibility-scheduling-probe': (109, 5), 'generation-probe': (109, 0), 'complete-probe': (118, 0), 'development': (354, 0), 'production': (354, 0), 'related-development': (198, 0), 'related-production': (198, 0)}
results = {}
for name, (checks, failures) in expected.items():
    rows = json.loads(read(name + '/observations.json'))
    results[name] = {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}
    assert results[name] == {'checks': checks, 'failures': failures}, name
# Native timing can alter the stale callback's extra-read control, but these core failures repeated.
core = ['hidden countdown owns no animation timer', 'queued cancelled countdown callbacks cannot sample hidden state', 'hidden countdown has no native animation wakeups', 'hidden countdown has no native animation samples', 'foregrounding immediately samples countdown', 'finished countdown callbacks cannot sample']
for name in ['original-minimal', 'original-repeat']:
    rows = json.loads(read(name + '/observations.json'))
    assert all(any(row['name'] == key and row['actual'] != row['expected'] for row in rows) for key in core)
before = json.loads(read('source-before-verification.json'))
after = json.loads(read('source-after-verification.json'))
assert before == after
for name, digest in after.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
captures = [('race', 'packages/portal/src/play/race/LiveRaceGame.tsx'), ('package', 'packages/portal/package.json')]
diff = ''
for captured, source in captures:
    assert (p / (captured + '.after.txt')).read_bytes() == (root / source).read_bytes()
    diff += ''.join(difflib.unified_diff(read(captured + '.before.txt').splitlines(True), read(captured + '.after.txt').splitlines(True), fromfile='a/' + source, tofile='b/' + source))
assert (p / 'hook.before.txt').read_bytes() == (root / 'packages/portal/src/play/race/hooks/useRaceSession.ts').read_bytes()
verifier = 'packages/portal/scripts/verify-live-countdown-clock-browser.mjs'
assert (p / 'verifier.final.mjs').read_bytes() == (root / verifier).read_bytes()
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/' + verifier))
(p / 'own.diff').write_text(diff)
assert re.search(r'Test Suites:\s+15 skipped, 297 passed', read('portal-unit.log'))
assert re.search(r'Tests:\s+93 skipped, 2761 passed', read('portal-unit.log'))
assert 'error TS' not in read('portal-types.log')
doc = re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files', read('tsdoc.log'))
assert doc
targets = ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']
assert read('builds.log').splitlines() == [target + ' build passed' for target in targets]
for target in targets:
    assert 'artifact audit passed' in read('build-' + target + '.log'), target
assert re.search(r'Test Suites:\s+3 passed, 3 total', read('built-browser.log'))
assert re.search(r'Tests:\s+8 passed, 8 total', read('built-browser.log'))
for width in [1280, 390]:
    assert f'Repeated older server observations did not reset the five-second countdown at {width}px.' in read('related-stale-clock.log')
firefox = json.loads(read('firefox-native.json'))
assert len(firefox) == 6
assert all(row['errors'] == row['unhandled'] == [] for row in firefox)
assert firefox[0]['hidden'] and firefox[0]['timers'] == 1 and firefox[0]['queuedSamples'] == 1
assert firefox[1]['hidden'] and firefox[1]['timers'] == 0 and firefox[1]['queuedSamples'] == 0
assert not firefox[2]['hidden'] and firefox[2]['timers'] == 1 and firefox[2]['queuedSamples'] == 1 and firefox[2]['slots'] > firefox[1]['slots']
assert firefox[3]['gameplay'] == 1 and firefox[3]['timers'] == 0 and firefox[3]['queuedSamples'] == firefox[3]['queuedCalls'] == 0
assert firefox[4]['letters'] == ['t', 'e', '', ''] and firefox[4]['calls'] == []
assert firefox[5]['retired'] == 1 and firefox[5]['timers'] == firefox[5]['queuedSamples'] == firefox[5]['queuedCalls'] == 0 and firefox[5]['leaveCount'] == 1
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:live-countdown-clock:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'LIVE_COUNTDOWN_REACT_MODE=production' in manifest['scripts']['test:live-countdown-clock:browser']
build_hashes = {str(f.relative_to(p / 'built')): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((p / 'built').rglob('*')) if f.is_file()}
assert build_hashes == json.loads(read('built-sha256.json'))
assert not Path(read('build-root.txt')).exists()
assert not Path(read('related-cache.txt')).exists()
summary = {'comparisons': results, 'focusedBrowserAssertions': 708, 'relatedBrowserAssertions': 396, 'browserAssertionsTotal': 1104, 'focusedJourneys': 30, 'viewports': [[390, 568], [390, 844], [1280, 844]], 'builtBrowser': {'suites': 3, 'tests': 8, 'failures': 0, 'latencyThresholdChanged': False}, 'unitTests': 2761, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'stableSourceInputs': len(after), 'sourceDelta': [], 'firefoxRecords': len(firefox), 'preservedBuildFiles': len(build_hashes), 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
