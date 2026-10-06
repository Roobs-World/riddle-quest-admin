from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/current-load-issued-state-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2356 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+10 failed, 4 passed, 14 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+4 failed, 4 total',read('red-latency.log'))
counts('green-latency-final.log',4,1);counts('green-emulator.log',14,1);counts('green-focused.log',62,3);counts('final-focused.log',62,3)
counts('backend-units.log',1647,134);counts('live-integrations.log',302,20);counts('built-browser.log',8,3)
def traces(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"elapsedMs":.*\}\s*',line)]
old=traces('red-latency.log');new=traces('green-latency-final.log');assert len(old)==len(new)==4
for index,(before,after) in enumerate(zip(old,new)):
 mode='classic' if index<2 else 'challenge';resumed=bool(index%2)
 assert before['mode']==after['mode']==mode and before['resumed']==after['resumed']==resumed
 assert before['elapsedMs']==(800 if resumed else 600) and after['elapsedMs']==(600 if resumed else 400)
 assert sum(p.startswith('direct:users/') for p in before['reads'])==1
 assert sum(p.startswith('direct:users/') for p in after['reads'])==0
 for trace in [before,after]:
  assert sum(p.startswith('transaction:') for p in trace['reads'])==(2 if resumed else 1)
  assert sum(p.startswith('direct:localizedRiddles/') for p in trace['reads'])==(1 if mode=='challenge' else 0)
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25897 declarations are documented across 1158 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==23 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode'] for j in jobs)
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','postIssuanceDirectSessionReads':{'ordinaryBefore':1,'ordinaryAfter':0,'terminalRotationBefore':2,'terminalRotationAfter':0},'retainedExplicitResumeValidationReads':1,'syntheticLatencyMs':{'fresh':{'before':600,'after':400},'resumed':{'before':800,'after':600}},'unchangedSessionTransactionReads':{'fresh':1,'resumed':2},'scope':'Real current Classic/Daily loaders, issuance and response projection with deterministic 200 ms persistence/catalog stages. Profile, early recovery, account leases, HTTP and commit delays are outside this model. Not a production latency measurement. Separate actual Admin SDK emulator cases verify canonical persistence, real terminal completion and loss rotation, reward replay, resume validation, recovery fields and fresh retry state. Early recovery and derived ranking/generation are isolated in those SDK cases to exercise the post-issuance branches.','newRealEmulatorCases':14,'backendUnitTests':1647,'backendUnitSuites':134,'emulatorTests':302,'emulatorSuites':20,'focusedTests':62,'focusedSuites':3,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25897,'tsdocFiles':1158,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2356,'preservedBuildFiles':1300,'ownedJobsTerminal':23,'resolvedPreflightFixtureIssues':['Daily seed challenge key corrected to match actual catalog identity','Unknown resume token expects the existing permission-denied contract','Declined loss finalized through the real four-argument API before testing rotation'],'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
