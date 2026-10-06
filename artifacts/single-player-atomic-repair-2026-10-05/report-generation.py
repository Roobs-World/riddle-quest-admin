from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/single-player-atomic-repair-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert source==json.loads(read('source-report.json')) and len(source)==2345

def traces(name):
 rows=[json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"legacy":.*\}\s*',line)]
 assert len(rows)==2
 return {row['legacy']:row for row in rows}
a=traces('latency-baseline.log');b=traces('final-focused.log');measurements=[]
for legacy in [False,True]:
 before,after=a[legacy],b[legacy]
 assert before['elapsedMs']==(800 if legacy else 600) and after['elapsedMs']==400
 assert before['reads'].count('direct:users/player-1')==2 and after['reads'].count('direct:users/player-1')==1
 assert sum(row.startswith('repair-write:') for row in before['reads'])==(1 if legacy else 0)
 assert not any(row.startswith('repair-write:') for row in after['reads'])
 measurements.append({'legacy':legacy,'beforeMs':before['elapsedMs'],'afterMs':after['elapsedMs'],'beforeReads':5,'afterReads':4,'separateRepairWritesBefore':1 if legacy else 0,'separateRepairWritesAfter':0})
assert re.search(r'Tests:\s+2 failed, 2 total',read('latency-baseline.log'))
assert re.search(r'Tests:\s+1 failed, 49 skipped, 50 total',read('matching-concurrency-red.log'))
for expected in ['550','300','true','false','classicIndex','multiplayerWins','unlockedAchievements']:assert expected in read('matching-concurrency-red.log')
assert re.search(r'Tests:\s+75 passed, 75 total',read('final-focused.log'))
assert re.search(r'Test Suites:\s+130 passed, 130 total',read('backend-units.log')) and re.search(r'Tests:\s+1600 passed, 1600 total',read('backend-units.log'))
assert re.search(r'Test Suites:\s+13 passed, 13 total',read('live-integrations.log')) and re.search(r'Tests:\s+225 passed, 225 total',read('live-integrations.log'))
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-lint.log')==read('backend-types.log')==''
assert 'Production module cycle audit passed (194 modules, 1101 runtime references)' in read('module-cycles.log')
assert '25597 declarations are documented across 1147 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert all(row['status']=='terminal' for row in jobs)
for name in ['final-emulator','final-builds','final-types','final-tsdoc','final-lint','final-focused','final-built-browser']:assert next(row for row in jobs if row['name']==name)['exitCode']==0
for snapshot,sourcePath in [('service-after.ts','firebase-functions/src/gameplay/firestoreService.ts'),('completion-after.ts','firebase-functions/src/gameplay/completeGameLogic.ts'),('test-after.ts','firebase-functions/src/__tests__/firestoreService.test.ts'),('transaction-test-after.ts','firebase-functions/src/__tests__/completeGameTransaction.test.ts'),('security-test-after.ts','firebase-functions/src/__tests__/completeGameSecurity.test.ts')]:assert (e/snapshot).read_bytes()==(r/sourcePath).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','measurements':measurements,'scope':'actual completion and profile preparation with 200ms simulated transport; finalization is a trusted terminal-state fixture; real emulator tests separately use actual issuance and guesses','concurrentProfilePreserved':['coins','hasPurchasedApp','stats','progress','unlockedAchievements'],'realSinglePlayerRepairCases':5,'backendUnitTests':1600,'backendUnitSuites':130,'emulatorTests':225,'emulatorSuites':13,'focusedTests':75,'types':'passed','targetedLint':'passed','moduleCycles':'passed','tsdocDeclarations':25597,'tsdocFiles':1147,'sixBuilds':'passed','youtube':'fixture','builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'stableSourceInputs':2345,'preservedBuildFiles':1300,'ownedJobsTerminal':len(jobs),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='measurements'},indent=2))
