from pathlib import Path
import datetime,hashlib,json,subprocess
root=Path(__file__).resolve().parents[3]
reports=root/'artifacts/live-race-safety-2026-10-02'
cache=Path('/home/craig-beswetherick/.cache/riddle-quest-review/live-race-safety-20261002')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def tree(path):
    entries=[]
    for file in sorted(path.rglob('*')):
        if file.is_file(): entries.append({'path':str(file.relative_to(path)), 'bytes':file.stat().st_size, 'sha256':sha(file)})
    digest=hashlib.sha256(json.dumps(entries,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'directory':str(path),'files':len(entries),'bytes':sum(x['bytes'] for x in entries),'treeSha256':digest}
source_names=[
'packages/core/src/race/raceSchemas.ts',
'packages/core/src/race/raceLiveSchemas.ts',
'firebase-functions/src/social/liveRaceSafetyTarget.ts',
'firebase-functions/src/social/socialSafety.ts',
'firebase-functions/src/social/socialSafetyCallables.ts',
'firebase-functions/src/reddit/redditGameplayEndpoint.ts',
'firebase-functions/src/__tests__/socialSafetyCallables.test.ts',
'firebase-functions/src/__tests__/race/liveRaceSafety.it.test.ts',
'firebase-functions/jest.rules.config.js',
'packages/portal/src/firebase.ts',
'packages/portal/src/play/firebaseRaceMatchmaking.ts',
'packages/portal/src/play/__tests__/firebaseRaceMatchmaking.test.ts',
'packages/portal/src/facebook/FacebookPlatformBootstrap.ts',
'packages/portal/src/reddit/RedditPlatformBootstrap.ts',
'packages/portal/src/play/race/LiveRaceGame.tsx',
'packages/portal/src/play/race/components/LiveRaceSafety.tsx',
'packages/portal/src/play/__tests__/liveMultiplayer.jest-playwright.support.ts',
'packages/portal/src/styles.race-lobby.css',
'packages/portal/src/play/useHostRiddleLifecycle.ts',
'packages/portal/src/play/__tests__/coinCollection.jest-playwright.test.ts',
'docs/evidence/live-race-safety-2026-10-02.md',
'docs/facebook-moderation-runbook.md',
'docs/facebook-instant-games-operations.md',
'docs/facebook-instant-games-progress.html']
result={'generatedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
'sourceBuildProvenanceConfirmed':False,'provenanceNote':'Shared dirty working tree; separate builds are not an atomic source snapshot.',
'uploadEligible':False,'deploymentPerformed':False,'providerWritesPerformed':False,
'checks':{'emulatorTests':11,'emulatorSuites':2,'functionsUnitTests':28,'focusedPlatformUnitTests':151,'coreUnitTests':297,'coreUnitSuites':32,'portalUnitTests':2237,'portalUnitSuites':264,'skippedBrowserTestsInUnitRun':116,'providerBrowserJourneys':2,'targetBuildsAndAudits':6},
'sources':[{'path':name,'sha256':sha(root/name)} for name in source_names],
'outputs':[{'target':name,**tree(cache/name)} for name in ['jest','facebook','reddit','youtube','netflix','yahoo']],
'compiledFunctions':tree(cache/'functions'),
'evidence':[{'path':str(file.relative_to(reports)),'sha256':sha(file)} for file in sorted(reports.rglob('*')) if file.is_file() and file.name!='manifest.json']}
(reports/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'manifest':'written','head':result['head'],'uploadEligible':False,'targetCount':len(result['outputs'])}))
