from pathlib import Path
import difflib, hashlib, json, re, subprocess

root = Path.cwd()
evidence = root / 'artifacts/checkpoint-writer-recovery-2026-10-06'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda name: json.loads((evidence / name).read_text())
expected = read('source-before.json')
assert len(expected) == 2448
assert read('source-terminal.json') == read('source-after-builds.json') == read('source-runtime-terminal.json') == expected
assert all(sha(root / p) == h for p, h in expected.items())
prior = json.loads((root / 'artifacts/attempt-recovery-commit-retirement-2026-10-06/source-before.json').read_text())
assert len(prior) == 2447 and set(prior) <= set(expected)
owned = read('owned-files.json')
assert len(owned) == 4 and len({row['path'] for row in owned}) == 4
patch = []
for row in owned:
    before = (root / row['before']).read_bytes() if row['before'] else b''
    after = (root / row['after']).read_bytes()
    assert sha(root / row['after']) == row['afterSha256'] == sha(root / row['path'])
    if row['before']:
        assert sha(root / row['before']) == row['beforeSha256'] == prior[row['path']]
    else:
        assert row['path'] not in prior
    patch.extend(difflib.unified_diff(before.decode().splitlines(keepends=True), after.decode().splitlines(keepends=True),
        fromfile='a/' + row['path'] if row['before'] else '/dev/null', tofile='b/' + row['path']))
assert ''.join(patch) == (evidence / 'owned.diff').read_text()
subprocess.run(['git', 'apply', '--reverse', '--check', str(evidence / 'owned.diff')], check=True)
assert {p for p in prior if prior[p] != expected[p]} == {row['path'] for row in owned if row['before']}
assert sha(evidence / 'persistence-before.ts') == prior['packages/portal/src/play/game/hooks/useGameSessionPersistence.ts']

jobs = read('owned-jobs.json')
assert jobs and all(row['status'] == 'terminal' and isinstance(row['exitCode'], int) for row in jobs)
assert all((evidence / log).is_file() for row in jobs for log in row['logs'])
for name in ['all-six-builds', 'chromium-matrix', 'firefox-matrix', 'portal-units', 'static-final', 'built-browser', 'facebook-built-browser', 'checkpoint-controls', 'original-probe-terminal']:
    assert next(row for row in jobs if row['name'] == name)['exitCode'] == 0
assert next(row for row in jobs if row['name'] == 'baseline-final')['exitCode'] == 1
assert '2898 passed, 2991 total' in (evidence / 'portal-units.log').read_text()
assert '15 skipped, 301 passed, 301 of 316 total' in (evidence / 'portal-units.log').read_text()
assert '8 passed, 8 total' in (evidence / 'built-browser.log').read_text()
assert '1 passed, 1 total' in (evidence / 'facebook-browser.log').read_text()
assert '26567 declarations' in (evidence / 'tsdoc-final.log').read_text()
assert '1265 source files' in (evidence / 'sizes-final.log').read_text()
assert 'Web Target boundary audit passed' in (evidence / 'boundaries.log').read_text()
assert 'Security configuration audit passed' in (evidence / 'security.log').read_text()
assert 'error TS' not in (evidence / 'types-final.log').read_text()

browser_cases = browser_assertions = 0
for engine in ['chromium', 'firefox']:
    for mode in ['development', 'production']:
        directory = evidence / f'{engine}-{mode}'
        values = json.loads((directory / 'observations.json').read_text())
        assert values and all(row['actual'] == row['expected'] for row in values)
        assert len({(row['width'], row['height'], row['scenario']) for row in values}) == 57
        assert len(values) == 474 and len(list(directory.glob('*.png'))) == 57
        browser_cases += 57
        browser_assertions += len(values)
        log = read(f'{engine}-{mode}.log')
        assert log['failures'] == [] and log['cases'] == 57 and log['checks'] == 474
        assert log['browserVersion'].startswith('153.')
red = read('red-final/observations.json')
assert len(red) == 33 and sum(row['actual'] != row['expected'] for row in red) == 7
assert {row['scenario'] for row in red} == {'host-late', 'hook-late', 'hook-background', 'hook-clear'}
assert all(any(row['scenario'] == scenario and row['actual'] != row['expected'] for row in red) for scenario in ['host-late','hook-late','hook-background','hook-clear'])
assert len(list((evidence / 'red-final').glob('*.png'))) == 4
for mode in ['development', 'production']:
    for prefix, checks, screenshots in [('commit', 180, 27), ('work', 32, 2)]:
        values = read(f'{prefix}-{mode}/observations.json')
        assert len(values) == checks and all(row['actual'] == row['expected'] for row in values)
        assert len(list((evidence / f'{prefix}-{mode}').glob('*.png'))) == screenshots
        assert read(f'{prefix}-{mode}.log')['failures'] == []
    probes = read(f'probe-{mode}.json')
    assert probes['before']['stored']['activeGame'] is None
    assert probes['after']['stored']['activeGame']['currentLetters'][0] == 'P' and probes['visibleDraft'] == 'P'
    assert len(probes['after']['probe']['reads']) == 1
    assert probes['after']['probe']['errors'] == probes['after']['probe']['unhandled'] == []
    original_log = 'probe-red-development-corrected.log' if mode == 'development' else 'probe-red-production.log'
    raw = json.loads((evidence / original_log).read_text().splitlines()[0])
    assert raw['after']['stored']['activeGame'] is None and raw['visibleDraft'] == 'P'
    assert raw['after']['probe']['errors'] == raw['after']['probe']['unhandled'] == []
    assert 'AssertionError' in (evidence / original_log).read_text()

proof = read('unchanged-authority-proof.json')
assert proof['allSelectedAuthorityInputsUnchanged'] and proof['unchangedInputs'] == len(proof['inputs']) == 824
assert all(expected[p] == prior[p] == h == sha(root / p) for p, h in proof['inputs'].items())
for row in read('reused-authority-evidence.json'):
    assert sha(root / row['path']) == row['sha256']
for name, tests, suites in [('core-units.log', 391, 39), ('backend-units.log', 1730, 138), ('live-integrations.log', 677, 38), ('node22-sdk.log', 17, 1)]:
    text = (root / 'artifacts/live-same-account-retirement-2026-10-06' / name).read_text()
    assert re.search(r'Tests:\s+' + str(tests) + r' passed, ' + str(tests) + r' total', text)
    assert re.search(r'Test Suites:\s+' + str(suites) + r' passed, ' + str(suites) + r' total', text)
copies = json.loads((root / 'artifacts/live-same-account-retirement-2026-10-06/core-copy-proof.json').read_text())
assert len(copies) == 24
assert all(sha(root / row['canonical']) == sha(root / row['copy']) == row['sha256'] for row in copies)

manifest = read('built-sha256.json')
built = evidence / 'built'
assert len(manifest) == 1301
assert {str(p.relative_to(built)): sha(p) for p in sorted(built.rglob('*')) if p.is_file()} == manifest
metadata = read('target-dependencies.json')
assert len(metadata) == 6
for row in metadata:
    assert sha(root / row['preserved']) == row['sha256'] and not (root / row['original']).exists()
    data = json.loads((root / row['preserved']).read_text())
    assert data['target'] == row['target']
    assert ('packages/portal/src/play/PlayHostApp.tsx' in data['modules']) == (row['target'] in ['jest', 'facebook', 'reddit'])
    assert not any('__tests__' in name or 'verify-checkpoint-writer-recovery-browser' in name for name in data['modules'])
    if row['target'] != 'facebook':
        assert not any('FacebookRewardedContinue' in name or 'FacebookAds' in name for name in data['modules'])
    if row['target'] in ['reddit', 'youtube', 'netflix', 'yahoo']:
        assert not any('firebase' in name.lower() for name in data['modules'])
    if row['target'] in ['youtube', 'netflix', 'yahoo']:
        assert not any('/LiveRaceGame' in name for name in data['modules'])
        assert not any(any(provider in name.lower() for provider in ['firebase', 'sentry', 'fbinstant', 'devvit']) for name in data['packages'])
for row in read('extra-facebook-metadata.json'):
    assert sha(root / row['preserved']) == row['sha256'] and not (root / row['original']).exists()
    assert not Path(row['outputDirectory']).exists()
for target in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']:
    assert f'{target} build passed' in (evidence / 'builds.log').read_text()
assert 'Devvit server build passed' in (evidence / 'builds.log').read_text()
assert not Path((evidence / 'build-root.txt').read_text().strip()).exists()
cleanup = read('cleanup.json')
assert cleanup['temporaryBuildRemoved'] and cleanup['builtBytesVerifiedBeforeCleanup'] == 1301
assert cleanup['ownedTargetMetadataPreservedAndRemoved'] == 6 and cleanup['extraFacebookMetadataPreservedAndRemoved'] == 1
assert cleanup['ownedBrowserJobsTerminal'] and cleanup['ownedBrowserScratchRemoved']
assert not list((root / 'packages/portal/node_modules/.cache').glob('checkpoint-writer-recovery-*'))
assert not list((root / 'packages/portal/node_modules/.cache').glob('checkpoint-writer-probe-*'))
summary = {'sourceInputs': len(expected), 'ownedSourceRecords': len(owned), 'terminalTrackedJobs': len(jobs),
    'portalUnitTests': 2898, 'portalSkippedTests': 93, 'newMountedCases': browser_cases, 'newMountedAssertions': browser_assertions,
    'backgroundOwnershipControlCases': 54, 'backgroundOwnershipControlAssertions': 360, 'serializationControlCases': 4, 'serializationControlAssertions': 64, 'builtBrowserTests': 9, 'isolatedTargetInventories': 6, 'preservedBuiltFiles': len(manifest),
    'unchangedAuthorityInputs': proof['unchangedInputs'], 'authorityEvidenceReused': True, 'cleanupVerified': True, 'goalComplete': False}
(evidence / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
