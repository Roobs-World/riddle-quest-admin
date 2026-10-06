from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-prompt-compatibility-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2359 and source==json.loads(read('source-report.json'))
counts('runtime-probe.log',1,1)
assert '{"poolAccepted":true,"selectedClueLength":2001,"liveProjection":"rejected","preloadedProjection":"rejected"}' in read('runtime-probe.log')
assert re.search(r'Tests:\s+2 failed, 14 passed, 16 total',read('red-unit.log'))
assert re.search(r'Tests:\s+4 failed, 6 passed, 10 total',read('red-emulator.log'))
counts('green-emulator.log',10,1);counts('green-focused.log',51,4)
counts('backend-units.log',1657,134);counts('live-integrations.log',344,23);counts('built-browser.log',8,3)
for name in ['green-emulator.log','emulator-run.log']:assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name)
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25975 declarations are documented across 1161 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==16 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']}
assert resolved=={'runtime-probe-config-preflight','tsdoc-probe'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'Race pool readiness validates text using the published prompt schema before category exposure or deck/seat publication.','reproduction':{'clueLength':2001,'poolAcceptedBefore':True,'liveResponseBefore':'schema rejection','preloadedResponseBefore':'schema rejection','matchingRedUnitCases':2,'matchingRedSdkCases':4},'newTests':{'unit':4,'realSdk':10},'boundaryControls':'2000 trimmed characters remain legal, including padded 2002-character stored clues; immutable private deck bytes and canonical account balances are retained.','validation':'Existing missing_metadata issue code; no new visible text or locale keys.','backendUnitTests':1657,'backendUnitSuites':134,'emulatorTests':344,'emulatorSuites':23,'focusedTests':51,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25975,'tsdocFiles':1161,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2359,'preservedBuildFiles':1300,'ownedJobsTerminal':16,'resolvedPreflightFailures':sorted(resolved),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
