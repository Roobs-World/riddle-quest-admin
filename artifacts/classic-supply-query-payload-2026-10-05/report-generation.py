from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/classic-supply-query-payload-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2351 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+2 failed, 6 passed, 8 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+1 failed, 7 passed, 8 total',read('catalog-only-emulator.log'))
assert re.search(r'Tests:\s+2 failed, 16 passed, 18 total',read('red-unit.log'))
counts('green-emulator.log',8,1);counts('green-focused.log',54,5);counts('final-focused.log',54,5);counts('backend-units.log',1640,132);counts('live-integrations.log',269,17);counts('built-browser.log',8,3)
def payloads(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"readCalls":.*\}\s*',line)]
old=payloads('red-emulator.log');intermediate=payloads('catalog-only-emulator.log');new=payloads('green-emulator.log');assert len(old)==len(intermediate)==len(new)==2
for before,partial,after in zip(old,intermediate,new):
 assert before['mode']==partial['mode']==after['mode'] and before['readCalls']==partial['readCalls']==after['readCalls']==1
 mode=after['mode'];assert mode in ['catalog','discovery']
 assert before['documentBytes']==(100084 if mode=='catalog' else 300235)
 assert partial['documentBytes']==(21 if mode=='catalog' else 300235)
 assert after['documentBytes']==(21 if mode=='catalog' else 10)
 assert after['loadedFields']==(['classicIndex'] if mode=='catalog' else [])
 assert before['loadedFields']==(['answer','classicIndex','provenance','text'] if mode=='catalog' else ['highestClassicIndex','locale','nextAttemptAtMs','privateBlob'])
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25759 declarations are documented across 1153 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==14 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode'] for j in jobs)
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','queryFieldSelection':{'catalog':['classicIndex'],'dueJobDiscovery':[]},'decodedSyntheticPayloadBefore':old,'decodedSyntheticPayloadAfter':new,'scope':'Actual Admin SDK queries and private Firestore emulator. Synthetic catalog text is 100000 characters; each of three due jobs contains a 100000-character unused field. Sizes measure decoded query document JSON, not wire bytes or production latency. One catalog/discovery query remains. Worker claim and settlement transaction reads are unchanged and independently load current canonical jobs.','thresholdOrderingLimitsAndDeduplicationPreserved':True,'canonicalWorkerRevalidationPreserved':True,'newRealEmulatorCases':8,'backendUnitTests':1640,'backendUnitSuites':132,'emulatorTests':269,'emulatorSuites':17,'focusedTests':54,'focusedSuites':5,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25759,'tsdocFiles':1153,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2351,'preservedBuildFiles':1300,'ownedJobsTerminal':14,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
