from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/guidance-locale-work-2026-10-05'

def read(name):
    return (p / name).read_text()

def observations(name):
    rows = json.loads(read(name + '/observations.json'))
    return {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}

expected = {'original-corrected': (32, 8), 'original-repeat': (32, 8), 'locale-only': (32, 2), 'rtl-scope-probe': (34, 1), 'complete-probe': (68, 0), 'final-minimal-original': (34, 9), 'final-minimal-repaired': (34, 0), 'development': (1632, 0), 'production': (1632, 0), 'guidance-recovery-development': (114, 0), 'guidance-recovery-production': (114, 0)}
results = {name: observations(name) for name in expected}
for name, (checks, failures) in expected.items():
    assert results[name] == {'checks': checks, 'failures': failures}, name
assert json.loads(read('source-before-verification.json')) == json.loads(read('source-after-verification.json'))
frozen = json.loads(read('source-after-verification.json'))
for name, digest in frozen.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
for captured, source in [('GuidanceOverlay.after.txt', 'packages/portal/src/play/guidance/GuidanceOverlay.tsx'), ('package.after.txt', 'packages/portal/package.json'), ('verifier.final.mjs', 'packages/portal/scripts/verify-guidance-locale-work-browser.mjs'), ('guidance-recovery-verifier.mjs', 'packages/portal/scripts/verify-guidance-storage-recovery-browser.mjs')]:
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
firefox = json.loads(read('firefox-native.json'))
assert len(firefox) == 9
assert firefox[0]['copy']['title'] != firefox[0]['expected']['title']
assert all(firefox[1]['copy'][key] == firefox[1]['expected'][key] for key in ['title', 'body', 'button'])
assert firefox[1]['targetUpdates'] == 0
assert firefox[2]['before'] == firefox[2]['after'] == 0
assert firefox[3]['cards'] == 0 and firefox[3]['marker'] == 'seen'
assert firefox[4]['highlightMatches'] is False and firefox[4]['targetLeft'] == 230 and firefox[4]['highlightLeft'] == 34
assert firefox[5]['highlightMatches'] is True and firefox[5]['title'] == firefox[5]['expectedTitle']
assert firefox[6]['cards'] == 0 and firefox[6]['before'] == firefox[6]['after']
assert firefox[7]['highlightMatches'] is True and firefox[7]['title'] == firefox[7]['expectedTitle']
assert firefox[8]['cards'] == 0 and firefox[8]['marker'] == 'seen' and firefox[8]['before'] == firefox[8]['after']
assert all(row['errors'] == row['unhandled'] == [] for row in firefox)
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:guidance-locale-work:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'GUIDANCE_LOCALE_REACT_MODE=production' in manifest['scripts']['test:guidance-locale-work:browser']
diff = ''
for a, b, name in [('GuidanceOverlay.before.txt', 'GuidanceOverlay.after.txt', 'packages/portal/src/play/guidance/GuidanceOverlay.tsx'), ('package.before.txt', 'package.after.txt', 'packages/portal/package.json')]:
    diff += ''.join(difflib.unified_diff(read(a).splitlines(True), read(b).splitlines(True), fromfile='a/' + name, tofile='b/' + name))
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/packages/portal/scripts/verify-guidance-locale-work-browser.mjs'))
(p / 'own.diff').write_text(diff)
summary = {'comparisons': results, 'finalBrowserAssertions': 3492, 'locales': 16, 'focusedJourneys': 192, 'viewports': [[390, 568], [390, 844], [1280, 844]], 'builtBrowser': {'suites': 3, 'tests': 8, 'failures': 0, 'latencyThresholdChanged': False}, 'unitTests': 2758, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'stableSourceInputs': len(frozen), 'sourceDelta': [], 'firefoxRecords': len(firefox), 'initialFixtureAttempt': 'Excluded: achievementEarned preceded the intended centered guidance; seed its existing seen marker before the corrected comparisons.', 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
assert summary['finalBrowserAssertions'] == sum(results[name]['checks'] for name in ['development', 'production', 'guidance-recovery-development', 'guidance-recovery-production'])
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
