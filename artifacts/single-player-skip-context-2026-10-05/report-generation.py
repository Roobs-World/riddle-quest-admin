from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/single-player-skip-context-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2350 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+3 failed, 7 passed, 10 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+8 failed, 26 passed, 34 total',read('red-focused.log'))
assert re.search(r'Tests:\s+1 failed, 33 passed, 34 total',read('first-fix-focused.log'))
counts('green-emulator.log',10,1);counts('green-focused.log',34,3);counts('final-focused.log',69,5);counts('backend-units.log',1637,132);counts('live-integrations.log',261,16);counts('built-browser.log',8,3)
def traces(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"elapsedMs":.*\}\s*',line)]
old=traces('baseline-latency.log');new=traces('green-latency.log');assert len(old)==len(new)==1
assert old[0]['elapsedMs']==800 and new[0]['elapsedMs']==600
assert len(old[0]['reads'])==3 and len(new[0]['reads'])==2
assert sum(x.startswith('direct:') for x in old[0]['reads'])==1 and all(x.startswith('transaction:') for x in new[0]['reads'])
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25739 declarations are documented across 1152 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==14 and all(j['status']=='terminal' for j in jobs)
for job in jobs:
 if job['name']=='built-browser':assert job['exitCode']==143 and job['resolvedBy']=='built-browser-retry'
 else:assert job['exitCode']==job['expectedExitCode']
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','skipReads':{'before':3,'after':2},'deterministicElapsedMs':{'before':800,'after':600},'timingScope':'Actual callable handler and skip transaction over a deterministic database seam: 200 ms per document read, 400 ms for the awaited supply task. No HTTP transport, account leases, commit latency or production latency is measured. Real SDK probes separately retain the callable account lease and verify no direct session read.','publicSkipResponseAndReceiptUnchanged':True,'replaySupplyUsesCurrentProgress':True,'issuedValidationInsideTransaction':True,'newRealEmulatorCases':10,'backendUnitTests':1637,'backendUnitSuites':132,'emulatorTests':261,'emulatorSuites':16,'focusedTests':69,'focusedSuites':5,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25739,'tsdocFiles':1152,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2350,'preservedBuildFiles':1300,'ownedJobsTerminal':14,'resolvedBrowserInterruption':{'initialExitCode':143,'rerun':'passed'},'resolvedPreflightFailures':['23 missing declaration comments repaired before source freeze'],'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
