from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parents[3]
reports = root / 'artifacts/live-race-history-2026-10-02'
cache = Path('/home/craig-beswetherick/.cache/riddle-quest-review/live-race-history-20261002')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tree(path):
    entries = [{'path': str(file.relative_to(path)), 'bytes': file.stat().st_size, 'sha256': sha(file)}
               for file in sorted(path.rglob('*')) if file.is_file()]
    return {'directory': str(path), 'files': len(entries), 'bytes': sum(row['bytes'] for row in entries),
            'treeSha256': hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}

sources = [
    'packages/core/src/race/raceLiveHistorySchemas.ts',
    'packages/core/src/race/__tests__/raceLiveHistorySchemas.test.ts',
    'packages/core/src/race/raceLiveSchemas.ts',
    'packages/core/src/race/index.ts',
    'firebase-functions/src/race/raceLiveHistory.ts',
    'firebase-functions/src/race/raceLiveCallables.ts',
    'firebase-functions/src/index.ts',
    'firebase-functions/src/reddit/redditGameplayEndpoint.ts',
    'firebase-functions/src/__tests__/race/raceLiveHistory.it.test.ts',
    'firebase-functions/src/__tests__/singlePlayerSessionTransactions.test.ts',
    'firebase-functions/scripts/audit-facebook-backend-exports.js',
    'firebase-functions/scripts/audit-facebook-backend-exports.test.js',
    'firebase-functions/jest.rules.config.js',
    'firebase-functions/firestore.indexes.json',
    'packages/portal/src/firebase.ts',
    'packages/portal/src/play/firebaseRaceMatchmaking.ts',
    'packages/portal/src/play/__tests__/firebaseRaceMatchmaking.test.ts',
    'packages/portal/src/facebook/FacebookPlatformBootstrap.ts',
    'packages/portal/src/reddit/RedditPlatformBootstrap.ts',
    'packages/portal/src/play/race/RaceTournamentEntry.tsx',
    'packages/portal/src/play/race/RaceContextBoard.tsx',
    'packages/portal/src/play/race/components/LiveRaceHistory.tsx',
    'packages/portal/src/play/__tests__/liveHistory.jest-playwright.support.ts',
    'packages/portal/src/play/__tests__/liveMultiplayer.jest-playwright.support.ts',
    'packages/portal/src/reddit/__tests__/redditTournament.jest-playwright.support.ts',
    'packages/portal/src/styles.race-lobby.css',
    'packages/reddit-app/src/server/index.ts',
    'docs/evidence/live-race-history-2026-10-02.md',
    'docs/facebook-instant-games-operations.md',
    'docs/reddit-games-operations.md',
    'docs/facebook-instant-games-progress.html',
    'docs/reddit-games-progress.html',
]
sources += [str(file.relative_to(root)) for file in sorted((root / 'src/locales').glob('*/race.json'))]
result = {
    'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'sourceBuildProvenanceConfirmed': False,
    'provenanceNote': 'Shared dirty tree changed concurrently; builds are not an atomic source snapshot.',
    'uploadEligible': False, 'deploymentPerformedByThisChat': False, 'providerWritesPerformedByThisChat': False,
    'checks': {'emulatorTests': 32, 'emulatorSuites': 3, 'historyEmulatorCases': 15,
               'functionsUnitTests': 1579, 'functionsUnitSuites': 128, 'coreUnitTests': 308, 'coreUnitSuites': 33,
               'portalUnitTests': 2246, 'portalUnitSuites': 265, 'skippedBrowserTestsInUnitRun': 117,
               'redditTrustedServerTests': 51, 'providerBrowserJourneys': 2, 'targetBuildsAndAudits': 6},
    'sources': [{'path': name, 'sha256': sha(root / name)} for name in sources],
    'outputs': [{'target': name, **tree(cache / name)} for name in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']],
    'compiledFunctions': tree(cache / 'functions'),
    'evidence': [{'path': str(file.relative_to(reports)), 'sha256': sha(file)}
                 for file in sorted(reports.rglob('*')) if file.is_file() and file.name != 'manifest.json'],
}
(reports / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'manifest': 'written', 'head': result['head'], 'uploadEligible': False, 'targetCount': len(result['outputs'])}))
