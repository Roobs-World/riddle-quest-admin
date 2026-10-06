from pathlib import Path
import difflib, hashlib, json, re, socket, subprocess

root = Path.cwd()
evidence = root / 'artifacts/live-same-account-retirement-2026-10-06'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda name: json.loads((evidence / name).read_text())
expected = read('source-before.json')
assert len(expected) == 2445
assert all((root / p).is_file() and sha(root / p) == digest for p, digest in expected.items())
assert read('source-terminal.json') == expected
prior = json.loads((root / 'artifacts/live-retired-leave-recovery-2026-10-05/source-before.json').read_text())
assert len(prior) == 2390 and set(prior) <= set(expected)

owned = read('owned-files.json')
assert len(owned) == 28 and len({row['path'] for row in owned}) == 28
generated = []
for row in owned:
    before = (root / row['before']).read_bytes() if row['before'] else b''
    after = (root / row['after']).read_bytes()
    assert sha(root / row['after']) == row['afterSha256'] == sha(root / row['path'])
    if row['before']:
        assert sha(root / row['before']) == row['beforeSha256']
        if row['path'] in prior:
            assert row['beforeSha256'] == prior[row['path']]
    generated.extend(difflib.unified_diff(before.decode().splitlines(keepends=True), after.decode().splitlines(keepends=True),
        fromfile='a/' + row['path'] if row['before'] else '/dev/null', tofile='b/' + row['path']))
assert ''.join(generated) == (evidence / 'owned.diff').read_text()
subprocess.run(['git', 'apply', '--reverse', '--check', str(evidence / 'owned.diff')], check=True)
authorized = {row['path'] for row in owned}
derivatives = {p for p in prior if '/dist/' in p and prior[p] != expected[p]}
assert len(derivatives) == 9
assert {p for p in prior if prior[p] != expected[p]} <= authorized | derivatives
assert len(read('core-copy-proof.json')) == 24
for row in read('core-copy-proof.json'):
    assert sha(root / row['canonical']) == sha(root / row['copy']) == row['sha256']
assert read('backend-sdk-input-proof.json')['allSelectedBackendAndCoreSourceAndCompiledInputsUnchanged']
assert read('registration-green-proof.json')['actualCanonicalSelected'] == 86
assert read('registration-green-proof.json')['all23NewRegistrationsPassedInFreshSdkSelection']
assert '86 emulator suites' in (evidence / 'e2e-coverage-final.log').read_text()

jobs = read('owned-jobs.json')
assert jobs and all(row['status'] == 'terminal' and isinstance(row['exitCode'], int) for row in jobs)
assert all((evidence / log).is_file() for row in jobs for log in row['logs'])
for name in ['complete-backend-emulator', 'final-six-builds', 'terminal-built-browser', 'facebook-built-browser-final', 'active-close-final']:
    assert next(row for row in jobs if row['name'] == name)['exitCode'] == 0

def suite(name, tests, suites):
    text = (evidence / name).read_text()
    assert re.search(r'Tests:\s+' + str(tests) + r' passed, ' + str(tests) + r' total', text), name
    assert re.search(r'Test Suites:\s+' + str(suites) + r' passed, ' + str(suites) + r' total', text), name

suite('core-units.log', 391, 39)
suite('backend-units.log', 1730, 138)
suite('live-integrations.log', 677, 38)
suite('node22-sdk.log', 17, 1)
suite('portal-contracts-terminal.log', 127, 6)
suite('built-browser-terminal.log', 8, 3)
suite('facebook-browser-final.log', 1, 1)
assert '[Pinned Functions runtime v22.23.1]' in (evidence / 'node22-sdk.log').read_text()
assert 'Script exited successfully (code 0)' in (evidence / 'backend-emulator.log').read_text()
assert 'fail 0' in (evidence / 'reddit-tests.log').read_text() and 'tests 51' in (evidence / 'reddit-tests.log').read_text()

browser = {}
for group, required_cases, required_checks in [('same', 24, 216), ('legacy', 168, 3000)]:
    cases = checks = screenshots = 0
    for engine in ['chromium', 'firefox']:
        for mode in ['development', 'production']:
            directory = evidence / f'{group}-{engine}-{mode}'
            values = json.loads((directory / 'observations.json').read_text())
            assert values and all(row['actual'] == row['expected'] for row in values)
            count = len({(row['width'], row['height'], row['scenario']) for row in values})
            assert len(list(directory.glob('*.png'))) == count
            cases += count
            checks += len(values)
            screenshots += count
    assert cases == required_cases and checks == required_checks
    browser[group] = {'cases': cases, 'assertions': checks, 'screenshots': screenshots}
confirmation = json.loads((evidence / 'confirmation/observations.json').read_text())
assert len(confirmation) == 369 and all(row['actual'] == row['expected'] for row in confirmation)
assert len(list((evidence / 'confirmation').glob('*.png'))) == 27
close = read('active-close-recovery/report.json')['report']
assert len(close) == 6 and all(row['pass'] for row in close)
assert len(list((evidence / 'active-close-recovery').glob('*.png'))) == 6
assert '8 !== 0' in (evidence / 'red-final.log').read_text()

for prefix in ['', 'first-pass/']:
    built = evidence / prefix / 'built'
    manifest = read(prefix + 'built-sha256.json')
    assert len(manifest) == 1301
    assert {str(p.relative_to(built)): sha(p) for p in sorted(built.rglob('*')) if p.is_file()} == manifest
    rows = read(prefix + 'target-dependencies.json')
    assert len(rows) == 6
    for row in rows:
        assert sha(root / row['preserved']) == row['sha256']

for target in ['youtube', 'netflix', 'yahoo', 'reddit']:
    data = read(f'target-metadata/{target}.json')
    assert not any('firebase' in name.lower() for name in data['modules'])
    if target != 'reddit':
        assert not any('/LiveRaceGame' in name for name in data['modules'])
        assert not any(any(provider in name.lower() for provider in ['firebase', 'sentry', 'fbinstant', 'devvit']) for name in data['packages'])
assert read('final-build-input-proof.json')['excludedByAllSixBuildInventories'] is True
assert read('final-build-input-proof.json')['addedConfigurationExcludedByAllSixBuildInventories'] is True
for target in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']:
    assert f'{target} build passed' in (evidence / 'builds-final.log').read_text()
assert 'Devvit server build passed' in (evidence / 'builds-final.log').read_text()
assert 'YouTube' in (evidence / 'build-youtube.log').read_text()
functions_manifest = read('compiled-functions-sha256.json')
functions_directory = evidence / 'compiled-functions'
assert {str(p.relative_to(functions_directory)): sha(p) for p in sorted(functions_directory.rglob('*')) if p.is_file()} == functions_manifest
assert read('functions-build-proof.json')['exitCode'] == 0
assert read('functions-build-proof.json')['productionOnlyEmit']
assert read('functions-build-proof.json')['files'] == len(functions_manifest)
assert 'retireLiveRaceJoin' in (functions_directory / 'lib/index.js').read_text()
assert not Path((evidence / 'functions-build-root.txt').read_text().strip()).exists()
assert '26525 declarations' in (evidence / 'tsdoc-final.log').read_text()
assert '1265 source files' in (evidence / 'file-sizes.log').read_text()

cleanup = read('cleanup.json')
assert cleanup['temporaryBuildRemoved'] and cleanup['ownedEmulatorsStopped']
assert cleanup['builtBytesVerifiedBeforeCleanup'] == 1301 and cleanup['ownedTargetMetadataPreservedAndRemoved'] == 6
assert cleanup['extraFacebookMetadataPreservedAndRemoved'] == 2
assert cleanup['ownedFunctionsBuildRemoved']
assert not Path((evidence / 'build-root.txt').read_text().strip()).exists()
for row in read('target-dependencies.json') + read('extra-facebook-metadata.json'):
    assert not (root / row['original']).exists()
    assert sha(root / row['preserved']) == row['sha256']
for port in [43333, 51565, 59561, 43495, 37953]:
    with socket.socket() as sock:
        assert sock.connect_ex(('127.0.0.1', port)) != 0, port

summary = {'sourceInputs': 2445, 'ownedSourceRecords': 28, 'terminalTrackedJobs': len(jobs),
    'backendUnits': 1730, 'realSdkCases': 677, 'pinnedNode22Cases': 17, 'clientContractCases': 127,
    'builtBrowserTests': 9, 'nativeBrowser': browser, 'confirmationCases': 27, 'activeCloseCases': 6,
    'preservedFinalBuiltFiles': 1301, 'isolatedTargetInventories': 6, 'cleanupVerified': True, 'goalComplete': False}
summary['compiledFunctionsFiles'] = len(functions_manifest)
(evidence / 'verification-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
