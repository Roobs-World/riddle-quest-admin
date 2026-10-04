from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parents[3]
reports = root / 'artifacts/facebook-live-context-delivery-2026-10-03'
cache = Path('/home/craig-beswetherick/.cache/riddle-quest-review/facebook-live-context-delivery-20261003')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tree(path):
    entries = [{'path': str(file.relative_to(path)), 'bytes': file.stat().st_size, 'sha256': sha(file)}
               for file in sorted(path.rglob('*')) if file.is_file()]
    return {'directory': str(path), 'files': len(entries), 'bytes': sum(row['bytes'] for row in entries),
            'treeSha256': hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}

sources = [
    'packages/core/src/race/raceLiveSchemas.ts',
    'packages/core/src/race/__tests__/facebookLiveContextSchema.test.ts',
    'packages/portal/src/facebook/FacebookPlatformEntry.tsx',
    'packages/portal/src/facebook/liveContextMatchmaking.ts',
    'packages/portal/src/facebook/__tests__/liveContextMatchmaking.test.ts',
    'packages/portal/src/play/__tests__/liveRematch.jest-playwright.support.ts',
    'firebase-functions/src/race/facebookLiveContextBinding.ts',
    'firebase-functions/src/race/facebookContextBoard.ts',
    'firebase-functions/src/race/facebookContextCallables.ts',
    'firebase-functions/src/race/raceLiveService.ts',
    'firebase-functions/src/race/raceLiveState.ts',
    'firebase-functions/src/race/raceLiveInvitation.ts',
    'firebase-functions/src/race/raceLiveReferralDelivery.ts',
    'firebase-functions/src/race/raceDeliveryRecords.ts',
    'firebase-functions/src/race/raceDeliveryRecovery.ts',
    'firebase-functions/src/race/racePerformanceDelivery.ts',
    'firebase-functions/src/facebook/facebookLiveRaceDelivery.ts',
    'firebase-functions/src/shared/sentryHandlers.ts',
    'firebase-functions/src/reddit/redditGameplayEndpoint.ts',
    'firebase-functions/src/__tests__/race/facebookLiveContextDelivery.it.test.ts',
    'firebase-functions/src/__tests__/race/raceLiveRematch.it.test.ts',
    'firebase-functions/jest.rules.config.js',
    'docs/evidence/facebook-live-context-delivery-2026-10-03.md',
    'docs/facebook-instant-games-operations.md',
    'docs/facebook-instant-games-progress.html',
]
sources += [str(file.relative_to(root)) for file in sorted((root / 'src/locales').glob('*/race.json'))]
build_results = json.loads((reports / 'build-results.json').read_text())
assert len(build_results) == 6 and all(row['buildExitCode'] == 0 and row['privateAuditExitCode'] == 0 for row in build_results)
assert '105 passed, 105 total' in (reports / 'emulator-final.log').read_text()
assert '1581 passed, 1581 total' in (reports / 'functions-units-final.log').read_text()
assert '2304 passed' in (reports / 'portal-units-final.log').read_text()
result = {
    'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'sourceBuildProvenanceConfirmed': False,
    'provenanceNote': 'Shared dirty tree changed concurrently; builds are not an atomic source snapshot.',
    'uploadEligible': False, 'deploymentPerformedByThisChat': False, 'providerWritesPerformedByThisChat': False,
    'checks': {'emulatorTests': 105, 'emulatorSuites': 7, 'newContextDeliveryCases': 30,
               'functionsUnitTests': 1581, 'functionsUnitSuites': 128, 'coreUnitTests': 315, 'coreUnitSuites': 35,
               'portalUnitTests': 2304, 'portalUnitSuites': 271, 'skippedBrowserTestsInUnitRun': 118,
               'redditTrustedServerTests': 51, 'providerBrowserJourneys': 2, 'selectedJestBrowserTests': 6,
               'unselectedJestBrowserTests': 68, 'fullJestBrowserAcceptanceEstablished': False, 'targetBuildsAndAudits': 6},
    'browserNote': 'Injected Chromium with FBInstant v8/Devvit through real target adapters; Firefox has no callable tool or browser surface in this session.',
    'sources': [{'path': name, 'sha256': sha(root / name)} for name in sources],
    'outputs': [{'target': name, **tree(cache / name)} for name in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']],
    'compiledFunctions': tree(cache / 'functions'),
    'evidence': [{'path': str(file.relative_to(reports)), 'sha256': sha(file)}
                 for file in sorted(reports.rglob('*')) if file.is_file() and file.name != 'manifest.json'],
}
(reports / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'manifest': 'written', 'head': result['head'], 'uploadEligible': False, 'targetCount': len(result['outputs'])}))
