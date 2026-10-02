from pathlib import Path
import datetime,hashlib,json,subprocess
root=Path(__file__).resolve().parents[3]
reports=root/'artifacts/facebook-live-contexts-2026-10-02'
cache=Path('/home/craig-beswetherick/.cache/riddle-quest-review/facebook-live-contexts-20261002')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def tree(path):
    entries=[]
    for file in sorted(path.rglob('*')):
        if file.is_file(): entries.append({'path':str(file.relative_to(path)), 'bytes':file.stat().st_size, 'sha256':sha(file)})
    digest=hashlib.sha256(json.dumps(entries,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'directory':str(path),'files':len(entries),'bytes':sum(x['bytes'] for x in entries),'treeSha256':digest}
source_names=[
'firebase-functions/src/race/facebookContextBoard.ts',
'firebase-functions/src/race/facebookLiveTournament.ts',
'firebase-functions/src/race/raceLiveTournament.ts',
'firebase-functions/src/__tests__/race/facebookContextBoard.it.test.ts',
'packages/portal/src/play/race/RaceTournamentEntry.tsx',
'packages/portal/src/play/race/RaceContextBoard.tsx',
'packages/portal/src/facebook/FacebookRaceEntry.tsx',
'packages/portal/src/facebook/FacebookOverlayCapability.ts',
'packages/portal/src/facebook/fbinstant.ts',
'packages/portal/src/facebook/__tests__/FacebookOverlayCapability.test.ts',
'packages/portal/src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts',
'packages/portal/src/facebook/__tests__/raceDialogs.jest-playwright.support.ts',
'packages/portal/src/facebook/__tests__/tournaments.jest-playwright.support.ts',
'packages/portal/src/styles.race-lobby.css',
'docs/evidence/facebook-live-contexts-2026-10-02.md',
'docs/facebook-instant-games-operations.md',
'docs/facebook-instant-games-progress.html']
result={'generatedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
'sourceBuildProvenanceConfirmed':False,'provenanceNote':'Shared dirty working tree; separate builds are not an atomic source snapshot.',
'uploadEligible':False,'deploymentPerformed':False,'providerWritesPerformed':False,
'checks':{'emulatorTests':44,'emulatorSuites':6,'functionsUnitTests':33,'platformUnitTests':173,'portalUnitTests':2236,'portalUnitSuites':264,'skippedBrowserTestsInUnitRun':116,'providerBrowserJourneys':2,'targetBuildsAndAudits':6},
'sources':[{'path':name,'sha256':sha(root/name)} for name in source_names],
'outputs':[{'target':name,**tree(cache/name)} for name in ['jest','facebook','reddit','youtube','netflix','yahoo']],
'compiledFunctions':tree(cache/'functions'),
'evidence':[{'path':str(file.relative_to(reports)),'sha256':sha(file)} for file in sorted(reports.rglob('*')) if file.is_file() and file.name!='manifest.json']}
(reports/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'manifest':'written','head':result['head'],'uploadEligible':False,'targets':[{k:v for k,v in output.items() if k!='directory'} for output in result['outputs']]}))
