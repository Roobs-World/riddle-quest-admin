from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/live-join-identity-payload-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2357 and source==json.loads(read('source-report.json'))
assert re.search(r'Tests:\s+6 failed, 6 passed, 12 total',read('red-emulator.log'))
assert re.search(r'Tests:\s+1 failed, 11 passed, 12 total',read('mask-only-emulator.log'))
counts('green-emulator.log',12,1);counts('focused-mask-probe.log',19,2);counts('final-focused.log',19,2)
counts('backend-units.log',1647,134);counts('live-integrations.log',314,21);counts('built-browser.log',8,3)
def traces(name):return {row['kind']:row['reads'] for row in [json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{.*"kind":.*\}\s*',line)]}
old=traces('red-emulator.log');partial=traces('mask-only-emulator.log');new=traces('green-emulator.log')
kinds=['public','private','reconnect','preview','accept','accepted-recovery'];assert set(old)==set(partial)==set(new)==set(kinds)
for kind in kinds:
 count=1 if kind in kinds[:3] else 2
 assert len(old[kind])==len(partial[kind])==(3 if kind=='accept' else count) and len(new[kind])==count
 for record in old[kind]:
  creator=record['path'].endswith('a'*40)
  assert record['bytes']==(100108 if creator else 100106) and record['fields']==['avatarUrl','coins','level','privateBlob','username']
 for records in [partial[kind],new[kind]]:
  for record in records:
   creator=record['path'].endswith('a'*40)
   assert record['bytes']==(79 if creator else 77) and record['fields']==['avatarUrl','level','username']
 if kind not in kinds[:3]:
  assert sum(record['path'].endswith('b'*40) for record in new[kind])==1
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-types.log')==read('backend-lint.log')==''
assert '25929 declarations are documented across 1159 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==18 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode'] for j in jobs)
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','selectedIdentityFields':['username','level','avatarUrl'],'syntheticDecodedProfileBytes':{'creator':{'before':100108,'after':79},'viewer':{'before':100106,'after':77}},'newAcceptanceProfileReads':{'before':3,'after':2},'decodedSyntheticTotalBytesByPath':{kind:{'before':sum(record['bytes'] for record in old[kind]),'after':sum(record['bytes'] for record in new[kind])} for kind in kinds},'scope':'Actual Admin SDK and private loopback Firestore emulator. Canonical fixture profiles contain a 100000-character unused field. Bytes measure decoded JSON, not wire bytes, billing reduction or production latency. Field masks retain whole canonical document transaction locks and fresh snapshots on retries. Invitation creator and viewer use one masked getAll call; new acceptance reuses its viewer snapshot within that same transaction.','newRealEmulatorCases':12,'backendUnitTests':1647,'backendUnitSuites':134,'emulatorTests':314,'emulatorSuites':21,'focusedTests':19,'focusedSuites':2,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':25929,'tsdocFiles':1159,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2357,'preservedBuildFiles':1300,'ownedJobsTerminal':18,'resolvedPreflightFixtureIssues':['Deletion service assertion corrected to its existing account-deleted error contract'],'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
