from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/leaderboard-current-profile-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2348 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+9 failed, 1 passed, 10 total',read('matching-red-emulator.log'))
assert re.search(r'Tests:\s+14 failed, 21 passed, 35 total',read('matching-red-units.log'))
counts('green-emulator.log',10,1);counts('final-focused.log',72,4);counts('backend-units.log',1628,131);counts('live-integrations.log',247,15);counts('built-browser.log',8,3)
def payloads(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"readCalls":.*\}\s*',line)]
old=payloads('matching-red-emulator.log');new=payloads('green-emulator.log');assert len(old)==len(new)==3
for before,after in zip(old,new):
 assert before.get('mode')==after.get('mode') and before['readCalls']==after['readCalls']==1
 mode=after.get('mode','batch')
 assert before['documentBytes']==(100153 if mode=='batch' else 100176)
 assert after['documentBytes']==(79 if mode=='batch' else 147)
 assert 'coins' in before['loadedFields'] and 'privateBlob' in before['loadedFields']
 assert after['loadedFields']==(['avatarUrl','username'] if mode=='batch' else ['avatarUrl','stats','username'])
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25671 declarations are documented across 1150 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==11 and all(j['status']=='terminal' for j in jobs)
for j in jobs:assert j['exitCode']==(1 if j['name']=='initial-red-emulator' else 0)
for name,path in [('leaderboard','firebase-functions/src/gameplay/leaderboard.ts'),('leaderboard-test','firebase-functions/src/__tests__/leaderboard.test.ts'),('emulator-test','firebase-functions/src/__tests__/leaderboardCurrentProfile.it.test.ts')]:assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','freshDisplayFieldsFromExistingLivenessRead':True,'scoreOrderingAndLimitsPreserved':True,'publicFieldSelectionPaths':['dedicated leaderboard account batch','canonical fallback account query','canonical multiplayer account query'],'decodedSyntheticPayloadBefore':old,'decodedSyntheticPayloadAfter':new,'scope':'Real callable and Admin SDK on a private emulator. Synthetic account contains a 100000-character unused field. Sizes measure decoded document JSON, not wire bytes or production request latency. One observed canonical account load remains in each path.','newRealEmulatorCases':10,'backendUnitTests':1628,'backendUnitSuites':131,'emulatorTests':247,'emulatorSuites':15,'focusedTests':72,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25671,'tsdocFiles':1150,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2348,'preservedBuildFiles':1300,'ownedJobsTerminal':11,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
