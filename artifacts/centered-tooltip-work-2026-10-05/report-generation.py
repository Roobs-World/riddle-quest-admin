from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/centered-tooltip-work-2026-10-05'

def read(name):
    return (p / name).read_text()

def observations(name):
    rows = json.loads(read(name + '/observations.json'))
    return {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}

modes = {mode: observations(mode) for mode in ['development', 'production']}
assert all(row == {'checks': 1008, 'failures': 0} for row in modes.values())
related = {mode: observations('guidance-recovery-' + mode) for mode in modes}
assert all(row == {'checks': 114, 'failures': 0} for row in related.values())
originals = {case: observations(case) for case in ['original-minimal', 'original-repeat', 'final-minimal-original']}
assert all(row == {'checks': 21, 'failures': 5} for row in originals.values())
assert observations('final-minimal-repaired') == {'checks': 21, 'failures': 0}
assert observations('scope-probe') == {'checks': 189, 'failures': 0}
before = json.loads(read('source-before-verification.json'))
roots = ['src', 'assets', 'packages/core/src', 'packages/portal/src', 'packages/portal/targets', 'config/vite/portal', 'packages/portal/scripts', 'scripts/release']
selected = {str(file.relative_to(root)) for directory in roots for file in (root / directory).rglob('*') if file.is_file()}
selected.update(str(file.relative_to(root)) for file in (root / 'packages/portal').iterdir() if file.is_file() and not str(file).endswith(('.zip', '.tsbuildinfo')))
selected.update(['package.json', 'pnpm-lock.yaml', 'packages/core/package.json'])
assert selected == set(before), {'added': sorted(selected - set(before)), 'removed': sorted(set(before) - selected)}
after = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in sorted(selected)}
(p / 'source-after-verification.json').write_text(json.dumps(after, indent=2) + '\n')
assert after == before
captures = [('tooltip.after.txt', 'packages/portal/src/play/guidance/TooltipOverlay.tsx'), ('package.after.txt', 'packages/portal/package.json'), ('verifier.final.mjs', 'packages/portal/scripts/verify-centered-tooltip-work-browser.mjs'), ('guidance-recovery-verifier.mjs', 'packages/portal/scripts/verify-guidance-storage-recovery-browser.mjs')]
for captured, source in captures:
    assert (p / captured).read_bytes() == (root / source).read_bytes(), source
units = read('portal-unit.log')
assert re.search(r'Test Suites:\s+15 skipped, 297 passed', units)
assert re.search(r'Tests:\s+93 skipped, 2758 passed', units)
assert 'error TS' not in read('portal-types.log')
doc = re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files', read('tsdoc.log'))
assert doc
builds = read('builds-external.log').splitlines()
assert builds == [target + ' build passed' for target in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']]
browser = read('built-browser.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total', browser)
assert re.search(r'Tests:\s+8 passed, 8 total', browser)
firefox = json.loads(read('firefox-native.json'))
assert len(firefox) == 5
assert firefox[0]['reads'] == 4 and firefox[0]['observers'] == 1
assert firefox[1]['reads'] == 0 and firefox[1]['observers'] == 0
assert firefox[2]['reads'] > 0 and firefox[2]['observers'] == 1
assert firefox[3]['reads'] == firefox[2]['reads'] and firefox[3]['observers'] == 0
assert firefox[4]['activations'] == 1 and firefox[4]['cards'] == 0 and firefox[4]['observers'] == 0
assert all(row['errors'] == row['unhandled'] == [] for row in firefox)
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:centered-tooltip-work:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'CENTERED_TOOLTIP_REACT_MODE=production' in manifest['scripts']['test:centered-tooltip-work:browser']
diff = ''
for a, b, name in [('tooltip.before.txt', 'tooltip.after.txt', 'packages/portal/src/play/guidance/TooltipOverlay.tsx'), ('package.before.txt', 'package.after.txt', 'packages/portal/package.json')]:
    diff += ''.join(difflib.unified_diff(read(a).splitlines(True), read(b).splitlines(True), fromfile='a/' + name, tofile='b/' + name))
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/packages/portal/scripts/verify-centered-tooltip-work-browser.mjs'))
(p / 'own.diff').write_text(diff)
summary = {'originalMinimalRuns': originals, 'finalModes': modes, 'relatedGuidanceRecoveryModes': related, 'browserAssertions': sum(row['checks'] for row in [*modes.values(), *related.values()]), 'locales': 16, 'viewports': [[390, 568], [390, 844], [1280, 844]], 'focusedJourneys': 96, 'builtBrowser': {'suites': 3, 'tests': 8, 'failures': 0, 'latencyThresholdChanged': False}, 'unitTests': 2758, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'stableSourceInputs': len(before), 'sourceDelta': [], 'firefoxRecords': len(firefox), 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
assert summary['browserAssertions'] == 2244
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
report = '''# Centered tooltip layout work — 5 October 2026

`TooltipOverlay` now measures its card and registers a card ResizeObserver only when it has a target rectangle. Centered tooltips already use native CSS centering, so their measured height and stored viewport height never affect placement. Skipping this effect avoids synchronous geometry reads, observer setup, and the resulting measurement state update on the question transition that opens the leaderboard tooltip.

Anchored tooltips retain their existing measurement, resize listener, and observer. Switching from anchored to centered placement cleans them up immediately. Existing translated content, markup, focus behavior, dismissal, target boundaries and authority rules remain intact. This change preserves the shared checkout's earlier heading correction.

## Diagnosis

The preceding buffered question-transition investigation used an immutable 411-file Jest artifact. CPU-throttled traces showed synchronous tooltip geometry work among several rendering and parsing costs. The guidance-history comparison opened `leaderboardFifthCorrectAnswer` only in the unseen-history runs, but timing remained variable even when it was absent. That evidence identified a concrete unnecessary operation; it did not establish the cause of the earlier 112.4 ms threshold failure.

The focused regression drives the real TooltipOverlay with real translated content in StrictMode. Original entry performed four panel geometry reads and held one observer; returning to centered placement added two readings and retained an observer; a centered resize added another reading. All three original minimal runs failed the same five of 21 assertions. Anchored placement and dismissal controls passed in the original fixture. The scoped fix passed 189 assertions, and the final frozen minimal comparison passed 21 of 21.

## Verification

- Development and production React: 1,008 assertions per mode, zero failures across 16 locales and three viewport sizes (96 journeys). Checks include 32 native parent updates, long translated cards, centered/anchored transitions, viewport resize, exactly-once native advance, observer cleanup and browser errors.
- Guidance progress under blocked or failing storage: 114 assertions per mode, zero failures. Combined focused and related total: 2,244 assertions.
- Firefox MCP independently recorded original centered entry at four geometry readings/one observer and repaired entry at zero/zero. Anchored placement remained measurable and visible; returning to centered placement added no readings and removed the observer. Native Got it dismissed once with no remaining observer, errors or unhandled rejection. Dismissal's final reading counter includes browser-driver interaction and is not used as a production work delta.
- Portal unit tests: 2,758 passed in 297 suites; types and TSDoc passed (25,215 declarations across 1,140 files).
- All six isolated target builds and their artifact audits passed. YouTube used the explicit fixture build; this is not YouTube release certification.
- Eight built-game tests in three suites passed against the newly built temporary Jest/Reddit artifacts, covering hosted gameplay/navigation, Profile guidance and Reddit flows. The existing feedback and buffered-transition latency limits were unchanged.
- 1,501 selected source inputs, including content, locales, target configuration, browser verifiers and release scripts, were unchanged throughout final verification. Captured after-files match current source. Exact own changes are in `own.diff`.

The initial custom build directory inside the checkout was rejected by the existing output safety contract. It was replaced with a unique external `/tmp` directory without weakening that contract. All 1,300 built files were copied into the evidence directory, their hashes compared, and the temporary build directory removed. Both Firefox servers exited successfully, their fixture caches were removed, and only this pass's tabs were closed.

## Limits and continued work

This pass proves elimination of unnecessary centered-tooltip layout work. It does not claim a measured end-to-end speedup, resolve every throttled timing spike, or certify real multiplayer network latency. The immutable timing results and their limitations are documented separately in `buffered-transition-timing-2026-10-05.md`. Further investigation can distinguish bridge parsing, checkpoint restoration, rendering and frame scheduling with controlled probes. The broader reliability, performance, playability and latency goal remains active.

Raw observations, logs, source captures, screenshots, build hashes, Firefox records and `verification-summary.json` are in `artifacts/centered-tooltip-work-2026-10-05/`. No commit, push, deployment or provider SDK change was made.
'''
(root / 'docs/evidence/centered-tooltip-work-2026-10-05.md').write_text(report)
print(json.dumps(summary, indent=2))
