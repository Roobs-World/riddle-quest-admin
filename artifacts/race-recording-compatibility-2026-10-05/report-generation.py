from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-recording-compatibility-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2364 and source==json.loads(read('source-report.json'))
counts('runtime-probe.log',1,1)
assert '{"hashConsistent":true,"archiveResolved":true,"storedAnswerUnits":5,"normalGuessUnits":3,"engineGuess":"rejected"}' in read('runtime-probe.log')
assert re.search(r'Tests:\s+4 failed, 24 passed, 28 total',read('red-unit.log'))
assert re.search(r'Tests:\s+18 failed, 2 passed, 20 total',read('red-emulator.log'))
counts('green-emulator.log',20,1);counts('green-focused.log',90,3)
counts('backend-units.log',1669,134);counts('live-integrations.log',401,27);counts('built-browser.log',8,3)
for name in ['green-emulator.log','emulator-run.log']:assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name)
assert read('backend-types.log')==read('backend-lint.log')==''
assert '26048 declarations are documented across 1166 files' in read('tsdoc.log')
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert read('builds-run.log').splitlines()==[target+' build passed' for target in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==20 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']};assert resolved=={'tsdoc-probe','green-emulator-initial-invalid-invite'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'A separate frozen-question compatibility guard runs after archive integrity resolution, in locked eligibility, and before new publication effects. Original source bytes, hashes, scoring history and cached publication receipts are retained.','reproduction':{'hashConsistent':True,'archiveResolvedBefore':True,'storedAnswerUnits':5,'normalGuessUnits':3,'engineGuessBefore':'rejected'},'matchingRedUnitCases':4,'matchingRedSdkCases':18,'newUnitCases':4,'newRealSdkCases':20,'scope':'New modern/legacy recorded entry, eligibility and public/private publication. Retained live ticket recovery and already accepted runs remain separate candidates.','controls':'Current/future bad answers, prepared/active entry and evaluation negotiation; rejected entries write no attempts/receipts/decks/profile exposure; invalid publication writes no rewards/candidates/invitation finalization; valid decomposed originals, cached publication receipts and repaired-request retry retain their authority.','fixtureCorrections':'Initial private invitation ID lacked the authenticated creator hash. Corrected matching baseline and green runs use the proper owner binding. A pre-existing legacy positive fixture now uses a six-letter answer instead of an eight-letter placeholder, preserving its original archive-recovery purpose under the shipped seven-slot contract. Four declaration comments were added after an initial documentation audit.','backendUnitTests':1669,'backendUnitSuites':134,'emulatorTests':401,'emulatorSuites':27,'focusedTests':90,'focusedSuites':3,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':26048,'tsdocFiles':1166,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2364,'preservedBuildFiles':1300,'ownedJobsTerminal':20,'resolvedPreflightFailures':sorted(resolved),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
