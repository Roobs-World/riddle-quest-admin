from pathlib import Path
import difflib, hashlib, json, re, subprocess

root = Path.cwd()
evidence = root / 'artifacts/pending-play-scope-retirement-2026-10-06'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda name: json.loads((evidence / name).read_text())
expected = read('source-before.json')
assert len(expected) == 2449
assert read('source-terminal.json') == read('source-after-builds.json') == read('source-runtime-terminal.json') == expected
assert all(sha(root / p) == h for p, h in expected.items())
prior = json.loads((root / 'artifacts/checkpoint-writer-recovery-2026-10-06/source-before.json').read_text())
assert len(prior) == 2448 and set(prior) <= set(expected)
owned = read('owned-files.json')
assert len(owned) == 3 and len({row['path'] for row in owned}) == 3
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
assert sha(evidence / 'owned-00-before.txt') == prior['packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts']

jobs = read('owned-jobs.json')
assert jobs and all(row['status'] == 'terminal' and isinstance(row['exitCode'], int) for row in jobs)
assert all((evidence / log).is_file() for row in jobs for log in row['logs'])
for name in ['all-six-builds-v2','portal-units-v2','static-final-v2','built-browser-v2','facebook-built-browser-v2','chromium-matrix-v2','firefox-matrix-v2','early-chromium-final','early-firefox-final','original-probe-terminal-v2','paid-preview-final-green']:
    assert next(row for row in jobs if row['name'] == name)['exitCode'] == 0
for name in ['original-red-probes','baseline-final','early-baseline-final','built-browser','paid-preview-current-and-prior-red']:
    assert next(row for row in jobs if row['name'] == name)['exitCode'] == 1
assert len(jobs) == 30
assert '2898 passed, 2991 total' in (evidence / 'portal-units-v2.log').read_text()
assert '15 skipped, 301 passed, 301 of 316 total' in (evidence / 'portal-units-v2.log').read_text()
assert '22 passed, 22 total' in (evidence / 'built-browser-v2.log').read_text()
assert '1 passed, 1 total' in (evidence / 'facebook-browser-v2.log').read_text()
assert '1 failed, 21 passed, 22 total' in (evidence / 'built-browser.log').read_text()
assert '26570 declarations' in (evidence / 'tsdoc-final-v2.log').read_text()
assert '1265 source files' in (evidence / 'sizes-final-v2.log').read_text()
assert 'Web Target boundary audit passed' in (evidence / 'boundaries-v2.log').read_text()
assert 'Security configuration audit passed' in (evidence / 'security-v2.log').read_text()
assert 'error TS' not in (evidence / 'types-final-v2.log').read_text()

browser_cases = browser_assertions = 0
for engine in ['chromium','firefox']:
    for mode in ['development','production']:
        for prefix, suffix, cases, checks in [('', '-v2', 84, 804), ('early-', '-final', 30, 159)]:
            name = prefix + engine + '-' + mode + suffix
            values = read(name + '/observations.json')
            assert len(values) == checks and all(row['actual'] == row['expected'] for row in values)
            assert len({(row['width'], row['height'], row['scenario']) for row in values}) == cases
            assert len(list((evidence / name).glob('*.png'))) == cases
            log = read(name + '.log')
            assert log['cases'] == cases and log['checks'] == checks and log['failures'] == [] and log['browserVersion'].startswith('153.')
            browser_cases += cases
            browser_assertions += checks
red = read('red-final/observations.json')
assert len(red) == 40 and sum(row['actual'] != row['expected'] for row in red) == 12
assert {row['scenario'] for row in red} == {'account:guess','generation:hint','locale:continue','account:skip'}
red_early = read('early-red-final/observations.json')
assert len(red_early) == 53 and sum(row['actual'] != row['expected'] for row in red_early) == 8
for mode in ['development','production']:
    raw = json.loads((evidence / ('probe-red-' + mode + '.log')).read_text().splitlines()[0])
    assert raw['owner'] == 'Bob' and len(raw['messages']) == 2
    assert raw['messages'][0]['actor'] == 'Alice' and raw['messages'][1]['actor'] == 'Bob'
    assert raw['messages'][0]['message']['payload']['sessionToken'] == raw['messages'][1]['message']['payload']['sessionToken']
    final = read('probe-' + mode + '.json')
    assert final['owner'] == 'Bob' and len(final['messages']) == 1 and final['messages'][0]['actor'] == 'Alice'
    assert final['errors'] == final['unhandled'] == []
for name in ['paid-preview-trace','paid-preview-prior']:
    result = read(name + '.json')
    assert result['h1'] is None and result['card'] is None and result['heldSkip'] and result['elapsedMs'] >= 1000
    assert any(row['type'] == 'host:riddleLoaded' and row.get('requestId','').startswith('skip-') for row in result['host'])
result = read('paid-preview-final.json')
assert result['h1'] == 'What has a face and hands but no arms?' and result['heldSkip'] and result['elapsedMs'] < 250
for name, digest in read('supplemental-harness-sha256.json').items(): assert sha(evidence / name) == digest
v1 = read('source-before-v1.json')
assert v1 == read('source-after-builds-v1.json') == read('source-runtime-terminal-v1.json')
assert set(v1) == set(expected) and {p for p in v1 if v1[p] != expected[p]} == {'packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts'}
assert sha(root / 'packages/portal/src/play/__tests__/queuedCoinActions.jest-playwright.test.ts') == prior['packages/portal/src/play/__tests__/queuedCoinActions.jest-playwright.test.ts']

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
    assert ('packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts' in data['modules']) == (row['target'] in ['jest', 'facebook', 'reddit'])
    assert not any('__tests__' in name or 'verify-pending-play-scope-retirement-browser' in name for name in data['modules'])
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
    assert f'{target} build passed' in (evidence / 'builds-v2.log').read_text()
assert 'Devvit server build passed' in (evidence / 'builds-v2.log').read_text()
assert not Path((evidence / 'build-root.txt').read_text().strip()).exists()
cleanup = read('cleanup.json')
assert cleanup['temporaryBuildRemoved'] and cleanup['builtBytesVerifiedBeforeCleanup'] == 1301
assert cleanup['ownedTargetMetadataPreservedAndRemoved'] == 6 and cleanup['extraFacebookMetadataPreservedAndRemoved'] == 1
assert cleanup['ownedBrowserJobsTerminal'] and cleanup['ownedBrowserScratchRemoved']
assert all(not list((root / 'packages/portal/node_modules/.cache').glob(prefix + '*')) for prefix in ['pending-scope-probe-','pending-scope-retirement-','early-skip-check-'])
for folder, manifest_name, inventory_name, extra_name in [('built-v1','built-sha256-v1.json','target-dependencies-v1.json','extra-facebook-metadata-v1.json')]:
    manifest_v1 = read(manifest_name)
    assert len(manifest_v1) == 1301
    assert {str(p.relative_to(evidence / folder)): sha(p) for p in sorted((evidence / folder).rglob('*')) if p.is_file()} == manifest_v1
    assert len(read(inventory_name)) == 6 and len(read(extra_name)) == 1
    for row in read(inventory_name) + read(extra_name):
        assert sha(root / row['preserved']) == row['sha256'] and not (root / row['original']).exists() and not Path(row['outputDirectory']).exists()
assert cleanup['priorPhaseBuiltBytesVerifiedAndPreserved'] == 1301 and cleanup['priorPhaseTemporaryBuildRemoved']
summary = {'sourceInputs':len(expected),'ownedSourceRecords':len(owned),'terminalTrackedJobs':len(jobs),
    'portalUnitTests':2898,'portalSkippedTests':93,'scopeCases':336,'scopeAssertions':3216,'earlyReplyCases':120,'earlyReplyAssertions':636,
    'newMountedCases':browser_cases,'newMountedAssertions':browser_assertions,'builtBrowserTests':23,'isolatedTargetInventories':6,
    'preservedFinalBuiltFiles':len(manifest),'preservedInitialBuiltFiles':1301,'unchangedAuthorityInputs':824,
    'authorityEvidenceReused':True,'cleanupVerified':True,'goalComplete':False}
(evidence / 'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
