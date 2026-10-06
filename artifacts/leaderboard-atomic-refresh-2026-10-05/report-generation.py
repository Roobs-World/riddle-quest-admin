from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/leaderboard-atomic-refresh-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name)
 assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2346 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+5 failed, 5 total',read('red-emulator.log'))
assert 'https://example.invalid/old.png' in read('red-emulator.log') and 'Received: true' in read('red-emulator.log')
assert re.search(r'Tests:\s+1 failed, 20 skipped, 7 passed, 28 total',read('red-projection.log'))
assert re.search(r'Tests:\s+21 skipped, 8 passed, 29 total',read('projection-traces.log'))
counts('final-focused-traces.log',58,4)
counts('green-emulator.log',5,1);counts('backend-units.log',1611,130);counts('live-integrations.log',236,14);counts('final-focused.log',58,4);counts('built-browser.log',8,3)
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25618 declarations are documented across 1148 files' in read('tsdoc.log')
def traces(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"mode":.*\}\s*',line)]
baseline=traces('red-projection.log');fixed=traces('projection-traces.log');assert len(baseline)==len(fixed)==8
for before,after in zip(baseline,fixed):
 assert (before['mode'],before['win'],before['isAnonymous'])==(after['mode'],after['win'],after['isAnonymous'])
 board=after['win'] and not after['isAnonymous'];supply=after['win'] and after['mode']=='classic'
 assert before['profileReads']==int(board or supply) and after['profileReads']==int(supply)
 assert before['leaderboardTasks']==after['leaderboardTasks']==int(board)
 assert before['supplyTasks']==after['supplyTasks']==int(supply)
 assert after['elapsedMs']==max(600 if supply else 0,250 if board else 0)
 assert before['elapsedMs']==(600 if supply else 450 if board else 0)
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert read('builds-run.log').splitlines()==[target+' build passed' for target in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
metadata=json.loads(read('target-dependencies.json'));assert len(metadata)==6
for row in metadata:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==12 and all(j['status']=='terminal' for j in jobs)
for j in jobs:assert j['exitCode']==(1 if j['name']=='red-emulator' else 0)
for name,path in [('leaderboard','firebase-functions/src/gameplay/leaderboard.ts'),('completion','firebase-functions/src/gameplay/completeGameLogic.ts'),('leaderboard-test','firebase-functions/src/__tests__/leaderboard.test.ts'),('transaction-test','firebase-functions/src/__tests__/completeGameTransaction.test.ts'),('emulator-test','firebase-functions/src/__tests__/leaderboardAtomicRefresh.it.test.ts')]:assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','redRealFirestoreCases':5,'fixedRealFirestoreCases':5,'canonicalAccountReadOnEveryWriterAttempt':True,'missingAccountNeverRecreated':True,'avatarRemovalUsesReplacement':True,'backendUnitTests':1611,'backendUnitSuites':130,'emulatorTests':236,'emulatorSuites':14,'focusedTests':58,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25618,'tsdocFiles':1148,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2346,'preservedBuildFiles':1300,'ownedJobsTerminal':12,'cleanup':cleanup,'projectionCases':fixed,'performanceQualification':'The mocked leaderboard task hides its new transaction read. The matrix proves orchestration only, not a production Daily speedup. Daily moves its existing account read into the writer transaction; named Classic adds one concurrent account read to guarantee current ranking while content remains independent.'}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='projectionCases'},indent=2))
