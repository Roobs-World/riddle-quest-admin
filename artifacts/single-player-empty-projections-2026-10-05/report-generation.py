from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/single-player-empty-projections-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert source==json.loads(read('source-report.json')) and len(source)==2345

def traces(name,key):
 return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"'+key+r'":.*\}\s*',line)]
a=traces('latency-baseline.log','legacy');b=traces('final-focused.log','legacy');assert len(a)==len(b)==2
for before,after in zip(a,b):
 assert before['legacy']==after['legacy'] and before['elapsedMs']==400 and after['elapsedMs']==200
 assert before['reads'].count('direct:users/player-1')==1 and after['reads'].count('direct:users/player-1')==0
 assert len(before['reads'])==4 and len(after['reads'])==3
old=traces('projection-baseline.log','mode');new=traces('final-focused.log','mode');assert len(old)==len(new)==8
for before,after in zip(old,new):
 assert (before['mode'],before['win'],before['isAnonymous'])==(after['mode'],after['win'],after['isAnonymous'])
 leaderboard=after['win'] and not after['isAnonymous'];supply=after['win'] and after['mode']=='classic';required=leaderboard or supply
 assert before['profileReads']==1 and after['profileReads']==int(required)
 assert before['leaderboardTasks']==after['leaderboardTasks']==int(leaderboard)
 assert before['supplyTasks']==after['supplyTasks']==int(supply)
 expected=200+(400 if supply else 250) if required else 0
 assert after['elapsedMs']==expected and before['elapsedMs']==(expected if required else 200)
assert re.search(r'Tests:\s+2 failed, 2 total',read('latency-baseline.log'))
assert re.search(r'Tests:\s+5 failed, 20 skipped, 3 passed, 28 total',read('projection-baseline.log'))
assert re.search(r'Tests:\s+33 passed, 33 total',read('final-focused.log'))
assert re.search(r'Test Suites:\s+130 passed, 130 total',read('backend-units.log')) and re.search(r'Tests:\s+1608 passed, 1608 total',read('backend-units.log'))
assert re.search(r'Test Suites:\s+13 passed, 13 total',read('live-integrations.log')) and re.search(r'Tests:\s+231 passed, 231 total',read('live-integrations.log'))
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-lint.log')==read('backend-types.log')==''
assert '25608 declarations are documented across 1147 files' in read('tsdoc.log')
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert read('builds-run.log').splitlines()==[target+' build passed' for target in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
for row in json.loads(read('target-dependencies.json')):assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==11 and all(row['status']=='terminal' for row in jobs)
for name in ['final-emulator','final-builds','final-tsdoc','final-lint','final-focused','final-built-browser']:assert next(row for row in jobs if row['name']==name)['exitCode']==0
for snapshot,sourcePath in [('completion-after.ts','firebase-functions/src/gameplay/completeGameLogic.ts'),('latency-test-after.ts','firebase-functions/src/__tests__/singlePlayerCompletionRepairLatency.test.ts'),('transaction-test-after.ts','firebase-functions/src/__tests__/completeGameTransaction.test.ts'),('emulator-test-after.ts','firebase-functions/src/__tests__/singlePlayerAtomicRepair.it.test.ts')]:assert (e/snapshot).read_bytes()==(r/sourcePath).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','lossModelBeforeMs':400,'lossModelAfterMs':200,'lossReadsBefore':4,'lossReadsAfter':3,'scope':'actual completion with 200ms simulated reads and trusted terminal finalization fixture; projection-only model uses mocked authority with 200ms profile read and 250/400ms tasks; emulator tests use actual issuance and guesses','projectionCases':new,'requiredProjectionsStillAwaited':True,'realSessionMatrixCases':8,'realRepairCasesTotal':11,'backendUnitTests':1608,'backendUnitSuites':130,'emulatorTests':231,'emulatorSuites':13,'focusedTests':33,'types':'passed','targetedLint':'passed','tsdocDeclarations':25608,'tsdocFiles':1147,'sixBuilds':'passed','youtube':'fixture','builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'stableSourceInputs':2345,'preservedBuildFiles':1300,'ownedJobsTerminal':11,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='projectionCases'},indent=2))
