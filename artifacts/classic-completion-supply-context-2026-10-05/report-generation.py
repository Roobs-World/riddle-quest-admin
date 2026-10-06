from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/classic-completion-supply-context-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2347 and source==json.loads(read('source-report.json'))
def traces(name,key):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"'+key+r'":.*\}\s*',line)]
old=traces('matching-red-content.log','legacy');new=traces('final-content-traces.log','legacy');assert len(old)==len(new)==2
for before,after in zip(old,new):
 assert before['legacy']==after['legacy'] and before['elapsedMs']==800 and after['elapsedMs']==600
 assert len(before['reads'])==5 and len(after['reads'])==4
 assert before['reads'].count('direct:users/player-1')==1 and after['reads'].count('direct:users/player-1')==0
 assert before['reads'].count('transaction:users/player-1')==after['reads'].count('transaction:users/player-1')==2
assert re.search(r'Tests:\s+2 failed, 2 total',read('matching-red-content.log'))
counts('final-content-traces.log',2,1);counts('final-focused.log',40,4);counts('backend-units.log',1617,131);counts('live-integrations.log',237,14);counts('built-browser.log',8,3)
assert re.search(r'Tests:\s+25 skipped, 8 passed, 33 total',read('final-projection-traces.log'))
fixed=traces('final-projection-traces.log','mode');assert len(fixed)==8
for row in fixed:
 board=row['win'] and not row['isAnonymous'];supply=row['win'] and row['mode']=='classic'
 assert row['profileReads']==0 and row['leaderboardTasks']==int(board) and row['supplyTasks']==int(supply)
 assert row['elapsedMs']==max(400 if supply else 0,250 if board else 0)
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25643 declarations are documented across 1149 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==13 and all(j['status']=='terminal' and j['exitCode']==0 for j in jobs)
for name,path in [('completion','firebase-functions/src/gameplay/completeGameLogic.ts'),('transaction-test','firebase-functions/src/__tests__/completeGameTransaction.test.ts'),('emulator-test','firebase-functions/src/__tests__/singlePlayerAtomicRepair.it.test.ts'),('latency-test','firebase-functions/src/__tests__/singlePlayerContentPreparationLatency.test.ts')]:assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','classicWinTransportModelBeforeMs':800,'classicWinTransportModelAfterMs':600,'modelDocumentReadsBefore':5,'modelDocumentReadsAfter':4,'scope':'Actual completion, profile preparation and atomic leaderboard writer with 200ms simulated reads and 400ms stubbed supply work. Terminal session finalization is trusted and injected; transaction commit and production network latency are outside the model.','finalAttemptContextOnly':True,'replayUsesCurrentCommittedProgress':True,'missingAccountSkipsContent':True,'backendUnitTests':1617,'backendUnitSuites':131,'emulatorTests':237,'emulatorSuites':14,'singlePlayerRepairAndSupplyCases':12,'focusedTests':40,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25643,'tsdocFiles':1149,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2347,'preservedBuildFiles':1300,'ownedJobsTerminal':13,'cleanup':cleanup,'projectionCases':fixed}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='projectionCases'},indent=2))
