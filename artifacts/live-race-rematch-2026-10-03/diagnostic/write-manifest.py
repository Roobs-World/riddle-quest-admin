from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parents[3]
reports = root / 'artifacts/live-race-rematch-2026-10-03'
cache = Path('/home/craig-beswetherick/.cache/riddle-quest-review/live-race-rematch-20261003')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tree(path):
    entries = [{'path': str(file.relative_to(path)), 'bytes': file.stat().st_size, 'sha256': sha(file)}
               for file in sorted(path.rglob('*')) if file.is_file()]
    return {'directory': str(path), 'files': len(entries), 'bytes': sum(row['bytes'] for row in entries),
            'treeSha256': hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}

sources = [
    'packages/core/src/race/raceLiveSchemas.ts',
    'packages/core/src/race/__tests__/raceLiveRematchSchemas.test.ts',
    'firebase-functions/src/race/raceLiveRematch.ts',
    'firebase-functions/src/race/raceLiveService.ts',
    'firebase-functions/src/race/raceLiveState.ts',
    'firebase-functions/src/race/raceLiveInvitation.ts',
    'firebase-functions/src/reddit/redditGameplayEndpoint.ts',
    'firebase-functions/src/__tests__/race/raceLiveRematch.it.test.ts',
    'firebase-functions/src/__tests__/race/raceLiveAccountDeletion.it.test.ts',
    'firebase-functions/jest.rules.config.js',
    'packages/portal/src/play/firebaseRaceMatchmaking.ts',
    'packages/portal/src/play/__tests__/firebaseRaceMatchmaking.test.ts',
    'packages/portal/src/facebook/FacebookPlatformBootstrap.ts',
    'packages/portal/src/reddit/RedditPlatformBootstrap.ts',
    'packages/portal/src/reddit/__tests__/redditBrowser.jest-playwright.test.ts',
    'packages/portal/src/play/PlayHostApp.tsx',
    'packages/portal/src/play/race/LiveRaceGame.tsx',
    'packages/portal/src/play/race/RaceTo10Game.tsx',
    'packages/portal/src/play/race/RaceTournamentEntry.tsx',
    'packages/portal/src/play/race/RaceContextBoard.tsx',
    'packages/portal/src/play/race/components/LiveRaceHistory.tsx',
    'packages/portal/src/play/race/components/LiveRaceInbox.tsx',
    'packages/portal/src/play/race/components/LiveRaceInvitationCard.tsx',
    'packages/portal/src/play/__tests__/liveRematch.jest-playwright.support.ts',
    'packages/portal/src/play/__tests__/liveHistory.jest-playwright.support.ts',
    'packages/portal/src/play/__tests__/liveMultiplayer.jest-playwright.support.ts',
    'packages/reddit-app/src/server/index.ts',
    'docs/evidence/live-race-rematches-2026-10-03.md',
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
    'checks': {'emulatorTests': 64, 'emulatorSuites': 4, 'rematchEmulatorCases': 18,
               'functionsUnitTests': 1579, 'functionsUnitSuites': 128, 'coreUnitTests': 313, 'coreUnitSuites': 34,
               'portalUnitTests': 2272, 'portalUnitSuites': 267, 'skippedBrowserTestsInUnitRun': 118,
               'redditTrustedServerTests': 51, 'providerBrowserJourneys': 2, 'selectedJestBrowserTests': 6,
               'unselectedJestBrowserTests': 68, 'fullJestBrowserAcceptanceEstablished': False, 'targetBuildsAndAudits': 6},
    'browserNote': 'Fresh Facebook 13_plus fixture build with injected FBInstant v8; owned Reddit build with injected Devvit; injected Chromium, not callable Firefox MCP.',
    'sources': [{'path': name, 'sha256': sha(root / name)} for name in sources],
    'outputs': [{'target': name, **tree(cache / name)} for name in ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']],
    'compiledFunctions': tree(cache / 'functions'),
    'evidence': [{'path': str(file.relative_to(reports)), 'sha256': sha(file)}
                 for file in sorted(reports.rglob('*')) if file.is_file() and file.name != 'manifest.json'],
}
(reports / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'manifest': 'written', 'head': result['head'], 'uploadEligible': False, 'targetCount': len(result['outputs'])}))
