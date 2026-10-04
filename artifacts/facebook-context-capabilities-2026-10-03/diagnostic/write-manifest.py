from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parents[3]
reports = root / 'artifacts/facebook-context-capabilities-2026-10-03'
cache = Path('/home/craig-beswetherick/.cache/riddle-quest-review/facebook-context-capabilities-20261003')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tree(path):
    entries = [{'path': str(file.relative_to(path)), 'bytes': file.stat().st_size, 'sha256': sha(file)}
               for file in sorted(path.rglob('*')) if file.is_file()]
    assert entries, f'Missing owned build: {path}'
    return {'directory': str(path), 'files': len(entries), 'bytes': sum(row['bytes'] for row in entries),
            'treeSha256': hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}

sources = [
    'packages/portal/src/facebook/FacebookPlatformBootstrap.ts',
    'packages/portal/src/facebook/FacebookPlatformEntry.tsx',
    'packages/portal/src/facebook/FacebookCapabilityPolicy.ts',
    'packages/portal/src/facebook/contexts.ts',
    'packages/portal/src/facebook/liveContextMatchmaking.ts',
    'packages/portal/src/facebook/__tests__/FacebookPlatformBootstrap.test.ts',
    'packages/portal/src/facebook/__tests__/FacebookCapabilityPolicy.test.ts',
    'packages/portal/src/facebook/__tests__/contexts.test.ts',
    'packages/portal/src/facebook/__tests__/liveContextMatchmaking.test.ts',
    'packages/portal/src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts',
    'packages/portal/src/facebook/__tests__/raceDialogs.jest-playwright.support.ts',
    'packages/portal/src/play/race/RaceTournamentEntry.tsx',
    'packages/portal/src/play/race/RaceContextBoard.tsx',
    'docs/evidence/facebook-context-capabilities-2026-10-03.md',
    'docs/facebook-instant-games-operations.md',
    'docs/facebook-instant-games-progress.html',
]
results = json.loads((reports / 'build-results.json').read_text())
assert len(results) == 6 and all(row['buildExitCode'] == 0 and row['privateAuditExitCode'] == 0 for row in results)
assert '4 failed, 19 passed' in (reports / 'baseline.log').read_text()
assert '42 passed, 42 total' in (reports / 'focused.log').read_text()
assert '2338 passed' in (reports / 'portal-units-final.log').read_text()
for name in ['facebook-chooser-only-browser.log', 'facebook-full-sdk-browser.log', 'reddit-browser.log']:
    assert '1 passed, 1 total' in (reports / name).read_text()
assert '68 skipped, 6 passed, 74 total' in (reports / 'jest-browser.log').read_text()
manifest = {
    'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'sourceBuildProvenanceConfirmed': False,
    'provenanceNote': 'Shared dirty tree changed concurrently; builds are not an atomic source snapshot.',
    'uploadEligible': False, 'deploymentPerformedByThisChat': False, 'providerWritesPerformedByThisChat': False,
    'checks': {'baselineFailingCases': 4, 'baselinePassingExistingCases': 19, 'focusedTests': 42, 'focusedSuites': 4,
               'portalUnitTests': 2338, 'portalUnitSuites': 273, 'skippedBrowserTestsInUnitRun': 118,
               'freshFacebookSdkVariants': 2, 'redditBrowserJourneys': 1, 'selectedJestBrowserTests': 6,
               'unselectedJestBrowserTests': 68, 'fullJestBrowserAcceptanceEstablished': False, 'targetBuildsAndAudits': 6},
    'browserNote': 'Injected Chromium with runtime SDK inventory assertions; Firefox is not exposed to this session.',
    'sources': [{'path': name, 'sha256': sha(root / name)} for name in sources],
    'outputs': [{'target': name, **tree(cache / name)} for name in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']],
    'evidence': [{'path': str(file.relative_to(reports)), 'sha256': sha(file)}
                 for file in sorted(reports.rglob('*')) if file.is_file() and file.name != 'manifest.json'],
}
(reports / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'manifest': 'written', 'head': manifest['head'], 'uploadEligible': False, 'targetCount': len(manifest['outputs'])}))
