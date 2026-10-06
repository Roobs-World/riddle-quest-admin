from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-content-query-payload-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2358 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+8 failed, 12 passed, 20 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+6 failed, 14 passed, 20 total',read('projection-only-emulator.log'))
assert re.search(r'Tests:\s+6 failed, 6 passed, 12 total',read('red-unit.log'))
counts('green-emulator.log',20,1);counts('green-focused.log',47,4);counts('final-focused.log',47,4);counts('latency-projection-probe.log',4,1)
counts('backend-units.log',1653,134);counts('live-integrations.log',334,22);counts('built-browser.log',8,3)
def traces(name):return [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"scoped":.*\}\s*',line)]
old=traces('red-emulator.log');partial=traces('projection-only-emulator.log');new=traces('green-emulator.log');assert len(old)==len(partial)==len(new)==2
fields=['answer','canonicalRiddleId','categoryId','difficultyBand','qualityVersion','raceEligible','riddleId','text']
for index,(before,intermediate,after) in enumerate(zip(old,partial,new)):
 scoped=bool(index);count=30 if scoped else 60
 assert before['scoped']==intermediate['scoped']==after['scoped']==scoped
 for trace in [before,intermediate,after]:assert trace['calls']==1 and trace['count']==len(trace['loadedFields'])==count
 assert before['bytes']==(3007881 if scoped else 6015521)
 assert intermediate['bytes']==after['bytes']==(7371 if scoped else 14501)
 assert all(actual==sorted(fields+['privateBlob']) for actual in before['loadedFields'])
 for trace in [intermediate,after]:assert all(actual==fields for actual in trace['loadedFields'])
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25954 declarations are documented across 1160 files' in read('tsdoc.log')
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
summary={'goal':'active','selectedContentFields':['riddleId','canonicalRiddleId','text','answer','categoryId','difficultyBand','raceEligible','qualityVersion'],'syntheticDecodedQueryBytes':{'singleCategory30Docs':{'before':3007881,'after':7371},'allCategories60Docs':{'before':6015521,'after':14501}},'queryCallsBeforeAndAfter':1,'riddleIdentityValidation':'Published prompt schema must accept the original ID unchanged; rejects missing, blank, whitespace-only, padded, oversized and non-string identities before category availability or deck selection.','scope':'Actual Admin SDK and private loopback Firestore emulator. Each eligible fixture document contains an unused 100000-character field. Sizes measure decoded document-array JSON, not wire bytes, billing savings or production latency. Locale/category/eligibility filters, document identities, pool validation, deterministic deck order and content version are retained.','newRealEmulatorCases':20,'newIdentityUnitCases':6,'backendUnitTests':1653,'backendUnitSuites':134,'emulatorTests':334,'emulatorSuites':22,'focusedTests':47,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25954,'tsdocFiles':1160,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2358,'preservedBuildFiles':1300,'ownedJobsTerminal':23,'probeScopeExtension':'Initial three basic identity cases expanded to six after tracing the published schema normalization and bounds; matching baseline/projection/fixed runs use all six.','cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
