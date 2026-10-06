from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/classic-supply-transaction-payload-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2352 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+1 failed, 9 passed, 10 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+1 failed, 9 passed, 10 total',read('claim-only-emulator.log'))
assert re.search(r'Tests:\s+1 failed, 7 passed, 8 total',read('red-unit.log'))
counts('green-emulator.log',10,1);counts('green-focused.log',54,5);counts('final-focused.log',54,5);counts('backend-units.log',1640,132);counts('live-integrations.log',279,18);counts('built-browser.log',8,3)
def payloads(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"readCalls":.*\}\s*',line)]
old=payloads('red-emulator.log');intermediate=payloads('claim-only-emulator.log');new=payloads('green-emulator.log');assert len(old)==len(intermediate)==len(new)==1
for trace in [old[0],intermediate[0],new[0]]:assert trace['readCalls']==trace['transactions']==len(trace['reads'])==2
for before,partial,after in zip(old[0]['reads'],intermediate[0]['reads'],new[0]['reads']):
 assert before['stage']==partial['stage']==after['stage']
 stage=after['stage'];assert stage in ['claim','settlement']
 assert before['documentBytes']==(100095 if stage=='claim' else 100156)
 assert partial['documentBytes']==(53 if stage=='claim' else 100156)
 assert after['documentBytes']==(53 if stage=='claim' else 50)
 assert 'privateBlob' in before['loadedFields']
 assert after['loadedFields']==(['completed','locale','nextAttemptAtMs'] if stage=='claim' else ['leaseId'])
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25787 declarations are documented across 1154 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==15 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode'] for j in jobs)
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','transactionFieldMasks':{'claim':['nextAttemptAtMs','completed','locale'],'settlement':['leaseId']},'decodedSyntheticPayloadBefore':old,'decodedSyntheticPayloadAfter':new,'scope':'Actual Admin SDK transactions and private Firestore emulator. Synthetic job contains a 100000-character unused field. Sizes measure decoded document JSON, not wire bytes or production latency. Two transaction reads remain. Generation provider is stubbed; canonical database reads/writes, locks and SDK retries remain real.','canonicalEligibilityLocaleAndLeaseValidationPreserved':True,'generationBackoffAndSupersededSettlementControlsPassed':True,'newRealEmulatorCases':10,'backendUnitTests':1640,'backendUnitSuites':132,'emulatorTests':279,'emulatorSuites':18,'focusedTests':54,'focusedSuites':5,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25787,'tsdocFiles':1154,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2352,'preservedBuildFiles':1300,'ownedJobsTerminal':15,'resolvedPreflightFailures':['Three missing test type-field comments repaired before source freeze'],'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
