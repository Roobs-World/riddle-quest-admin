from pathlib import Path
import difflib
import hashlib
import json
import re

root = Path('/home/craig-beswetherick/Documents/riddle-quest')
p = root / 'artifacts/modal-outside-tab-2026-10-05'
def read(name):
    return (p / name).read_text()
def observations(name):
    rows = json.loads(read(name + '/observations.json'))
    return {'checks': len(rows), 'failures': sum(row['actual'] != row['expected'] for row in rows)}

modes = {mode: observations(mode) for mode in ['development', 'production']}
related = {prefix + mode: observations(prefix + mode) for mode in modes for prefix in ['profile-keys-', 'modal-editor-', 'modal-boundary-', 'modal-admission-', 'profile-dismiss-']}
assert all(row['failures'] == 0 for row in [*modes.values(), *related.values()])
assert modes['development']['checks'] == modes['production']['checks'] == 1164
original = observations('original-final')
assert original == {'checks': 1164, 'failures': 120}
assert observations('final-minimal-original') == {'checks': 11, 'failures': 3}
assert observations('final-minimal-repaired') == {'checks': 11, 'failures': 0}
assert json.loads(read('source-before-verification.json')) == json.loads(read('source-after-verification.json'))
browser = read('final-built-browser.log')
assert re.search(r'Test Suites:\s+1 failed, 7 passed, 8 total', browser)
assert re.search(r'Tests:\s+1 failed, 37 passed, 38 total', browser)
assert 'bufferedTransitionMs' in browser and '112.39999999850988' in browser
hosted = read('final-hosted-browser.log')
assert re.search(r'Test Suites:\s+1 passed, 1 total', hosted)
assert re.search(r'Tests:\s+1 passed, 1 total', hosted)
wrong = re.search(r'Immediate wrong-answer feedback: ([\d.]+)ms', hosted)
correct = re.search(r'Immediate correct-answer feedback: ([\d.]+)ms', hosted)
assert wrong and correct
units = read('portal-unit.log')
assert re.search(r'Test Suites:\s+15 skipped, 297 passed', units)
assert re.search(r'Tests:\s+93 skipped, 2758 passed', units)
assert 'error TS' not in read('final-portal-types.log')
doc = re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files', read('final-tsdoc.log'))
assert doc
builds = read('final-builds.log').splitlines()
assert builds == [target + ' build passed' for target in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']]
captures = [('modal.after.txt', 'packages/portal/src/play/GameModalView.tsx'), ('verifier.final.mjs', 'packages/portal/scripts/verify-modal-outside-tab-browser.mjs'), ('playable.after.txt', 'packages/portal/src/playable/YouTubePlayableApp.tsx'), ('hosted-test.after.txt', 'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts'), ('reddit-test.after.txt', 'packages/portal/src/reddit/__tests__/redditBrowser.jest-playwright.test.ts')]
for captured, source in captures:
    assert (p / captured).read_bytes() == (root / source).read_bytes(), source
for name in ['verify-modal-editor-focus-browser.mjs', 'verify-modal-keyboard-admission-browser.mjs', 'verify-modal-keyboard-boundary-browser.mjs', 'verify-profile-confirmation-keyboard-browser.mjs', 'verify-profile-dismiss-focus-browser.mjs']:
    assert (p / name).read_bytes() == (root / 'packages/portal/scripts' / name).read_bytes(), name
before = json.loads(read('broader-source-after-fixture-updates.json'))
roots = ['src', 'assets', 'packages/core/src', 'packages/portal/src', 'packages/portal/targets', 'config/vite/portal', 'packages/portal/scripts', 'scripts/release']
selected = {str(file.relative_to(root)) for directory in roots for file in (root / directory).rglob('*') if file.is_file()}
selected.update(str(file.relative_to(root)) for file in (root / 'packages/portal').iterdir() if file.is_file() and not str(file).endswith(('.zip', '.tsbuildinfo')))
selected.update(['package.json', 'pnpm-lock.yaml', 'packages/core/package.json'])
assert selected == set(before), {'added': sorted(selected - set(before)), 'removed': sorted(set(before) - selected)}
after = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() if (root / name).exists() else None for name in before}
(p / 'broader-source-after-final-browser.json').write_text(json.dumps(after, indent=2) + '\n')
delta = [name for name in before if before[name] != after[name]]
assert not delta, delta
manifest = json.loads((root / 'packages/portal/package.json').read_text())
assert 'pnpm test:modal-outside-tab:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'MODAL_OUTSIDE_REACT_MODE=production' in manifest['scripts']['test:modal-outside-tab:browser']
(p / 'package.current.txt').write_bytes((root / 'packages/portal/package.json').read_bytes())
pairs = [('modal.before.txt', 'modal.after.txt', 'packages/portal/src/play/GameModalView.tsx'), ('package.before.txt', 'package.after.txt', 'packages/portal/package.json'), ('reddit-test.before.txt', 'reddit-test.after.txt', 'packages/portal/src/reddit/__tests__/redditBrowser.jest-playwright.test.ts'), ('hosted-test.before.txt', 'hosted-test.after.txt', 'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts'), ('playable.before.txt', 'playable.after.txt', 'packages/portal/src/playable/YouTubePlayableApp.tsx')]
diff = ''.join(''.join(difflib.unified_diff(read(a).splitlines(True), read(b).splitlines(True), fromfile='a/' + name, tofile='b/' + name)) for a, b, name in pairs)
diff += ''.join(difflib.unified_diff([], read('verifier.final.mjs').splitlines(True), fromfile='/dev/null', tofile='b/packages/portal/scripts/verify-modal-outside-tab-browser.mjs'))
(p / 'own.diff').write_text(diff)
summary = {'original': original, 'finalModes': modes, 'relatedModes': related, 'browserAssertions': sum(row['checks'] for row in [*modes.values(), *related.values()]), 'nativeJourneys': 192, 'builtBrowser': {'suites': 8, 'distinctTests': 38, 'finalFailures': 0, 'batchPassedTests': 37, 'batchFailedTests': 1, 'unchangedHostedRerunPassedTests': 1, 'batchBufferedTransitionMs': 112.4, 'bufferedTransitionLimitMs': 100, 'timingThresholdChanged': False}, 'unitTests': 2758, 'unitSuites': 297, 'types': 'passed', 'tsdocDeclarations': int(doc[1]), 'tsdocFiles': int(doc[2]), 'sixBuilds': 'passed', 'youtubeBuild': 'fixture', 'initialStableInputs': 766, 'finalBroaderStableInputs': len(before), 'finalBroaderDelta': delta, 'laterFixtureUpdates': json.loads(read('final-fixture-updates.json')), 'interruptedBatch': json.loads(read('final-browser-interruption.json')), 'cleanup': json.loads(read('cleanup.json')), 'goal': 'active'}
assert summary['browserAssertions'] == 6432
(p / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
report = f'''# Immediate modal Tab entry — 5 October 2026

`GameModalView` now sends native Tab and Shift+Tab from outside the active dialog to its first and last controls immediately. The active scope is the nested confirmation when present. Keyboard input no longer waits for deferred autofocus to enter the modal, and an outer Profile control cannot bypass its deletion confirmation's Tab loop.

The change resolves the scope once for both admission and candidate lookup. It preserves current keyboard ownership, earlier event claims, composing/legacy input guards, inert and retired surfaces, input caret behavior, and existing dismissal readiness. No new visible copy or provider calls were added.

## Diagnosis and proof

The original first-open failure reproduced twice at 390 × 568: 5 assertions with 1 failure per run, approximately 0.56 seconds each. Late-autofocus and no-key controls passed (5 and 4 assertions). Instrumentation confirmed one live listener and inert underlying gameplay; missing outside-focus admission was the leading explanation.

An outer-modal containment probe passed 42 assertions. Expanding it to nested confirmations exposed 5 failures in 44 assertions: an outer Profile control still belonged to the containing modal. Selecting the inner confirmation as the active scope corrected that gap.

The first expanded fixture also exposed three invalid claimed-key expectations. Its recorded trigger had become inert, and native dispatch retargeted focus to `BODY` before the event. Three diagnostic repeats captured that sequence. The final claimed-key fixture focuses a live outside toolbar control; its 328-assertion probe passed without changing the production policy for earlier key claims.

The final injected browser verifier covers Profile, Settings, Instructions, first entry before autofocus, outside refocus, nested confirmation, earlier key claims, covered and retired surfaces. It uses actual native Tab, Shift+Tab and Enter, three viewport sizes (390 × 568, 390 × 844 and 1280 × 844), and development and production React. It selectively holds the modal's autofocus callback, leaving browser and driver frames running. Thirty-two parent updates check retained focus and stable keyboard registration.

- Original full fixture: 1,164 assertions, 120 failures.
- Repaired fixture: 1,164 assertions per mode, 2,328 total, zero failures over 192 native journeys.
- Frozen minimal comparison: original 11 assertions / 3 failures / exit 1; repaired 11 / 0 / exit 0.
- Related Profile confirmation, editor focus, modal keyboard boundary/admission and Profile dismissal checks: 4,104 assertions, zero failures. Combined total: 6,432.

Firefox MCP independently confirmed the original Tab escape and nested-scope bypass, then immediate forward/reverse entry and preserved focus after frame release. Enter on Close fired once; nested Tab selected Cancel or Confirm without activating deletion. An earlier native claim retained its control. Final dismissal removed the listener. Destructive callbacks, console errors and unhandled rejections remained zero. Raw proof is in `firefox-native.json`.

## Shared checkout and final validation

The initial 766 selected client inputs were unchanged throughout the focused verification. Other work subsequently added rendered HTML/WCAG validation, changed artifact output paths, normalized locale text and corrected HTML semantics. Those edits were preserved and required fresh validation; earlier successful gates are retained separately from failed rechecks.

This pass additionally supplies group semantics for achievement collections on the standalone result and Progress screens, updates the stale Arabic test expectation and tooltip heading selector, and makes the hosted fixture use an ephemeral port with immediate listen-error rejection. Its old fixed port collided with another check and waited 120 seconds. Our temporary duplicate documentation comments were removed, preserving the shared helper's existing comments. `own.diff` contains this pass's changes without the other task's production edits.

Final built browser verification used completed artifacts (`PORTAL_USE_EXISTING_BUILD=1`): 37 tests passed in the eight-suite batch, and its remaining hosted journey passed on an unchanged full-journey rerun with no other checks from this task running alongside it. This covers 38 distinct tests across eight suites, including injected provider lifecycle, persistence, gameplay, rendered HTML and automated accessibility checks. The batch measured one buffered transition at 112.4 ms against its 100 ms limit; that failure is retained. No timing threshold or production code was changed to make the rerun pass, and the cause of this timing variation is not established. An earlier attempt ended with signal termination (exit 143) before producing results and is not counted as verification. Later shared fixture updates isolate automatic YouTube fixture builds, use each served artifact's own manifest, and require every HTML validator input to exist. Types and documentation were rechecked after those updates. The final 1,500 broader selected inputs, including locale/content assets and verification scripts, were unchanged from the settled fixture-update snapshot through completion; generated ZIPs and TypeScript cache files are excluded from the comparison.

Required checks passed: 2,758 unit tests in 297 suites; types; TSDoc ({doc[1]} declarations across {doc[2]} files); and all six isolated builds with their target and locale audits. YouTube used its explicit content fixture. This evidence does not establish YouTube release readiness or production network latency. The final hosted fixture observed local wrong/correct feedback at {wrong[1]} / {correct[1]} ms with server responses held.

The new verifier is registered in both React modes and in the main game-browser command. Firefox fixture servers exited successfully, their tabs and cache directories were removed, and no owned verifier process remains. No commit, push, deployment or destructive account action was performed. The broader reliability/performance/playability/latency goal remains active.

Artifacts: `artifacts/modal-outside-tab-2026-10-05/`, including original/repaired captures, one-variable probes, raw observations, screenshots, terminal logs, input hashes, `own.diff` and `verification-summary.json`.
'''
destination = root / 'docs/evidence/modal-outside-tab-2026-10-05.md'
destination.write_text(report)
print(json.dumps(summary, indent=2))
print('Report:', destination)
