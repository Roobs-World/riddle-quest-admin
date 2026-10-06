from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/live-settlement-latency-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert source==json.loads(read('source-report.json')) and len(source)==2343

def traces(name):
 rows=[json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"winner":.*\}\s*',line)]
 assert len(rows)==4
 return {(row['winner'],row['retryDeletion']):row for row in rows}
old=traces('matching-baseline.log');new=traces('final-latency-traces.log')
measurements=[]
for winner,retry in [(0,False),(1,False),(0,True),(1,True)]:
 a,b=old[winner,retry],new[winner,retry];factor=2 if retry else 1
 assert a['elapsedMs']==(800 if winner==0 else 1000)*factor
 assert b['elapsedMs']==800*factor
 assert len(a['reads'])==(10 if winner==0 else 11)*factor
 assert len(b['reads'])==(8 if winner==0 else 9)*factor
 for user in ['jest_'+'a'*40,'jest_'+'b'*40]:
  assert b['reads'].count('jestAccountDeletionTombstones/'+user)==factor
 measurements.append({'winnerSeat':winner,'retryDeletion':retry,'beforeMs':a['elapsedMs'],'afterMs':b['elapsedMs'],'beforeReads':len(a['reads']),'afterReads':len(b['reads'])})
assert re.search(r'Tests:\s+4 failed, 4 total',read('matching-baseline.log'))
assert re.search(r'Tests:\s+8 passed, 8 total',read('final-latency-traces.log'))
assert 'Expected: 125' in read('deletion-original-control.log') and 'Received: 100' in read('deletion-original-control.log')
assert re.search(r'Tests:\s+132 skipped, 4 passed, 136 total',read('deletion-orders-probe.log'))
assert re.search(r'Test Suites:\s+129 passed, 129 total',read('backend-units.log')) and re.search(r'Tests:\s+1586 passed, 1586 total',read('backend-units.log'))
assert re.search(r'Test Suites:\s+7 passed, 7 total',read('live-integrations.log')) and re.search(r'Tests:\s+136 passed, 136 total',read('live-integrations.log'))
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-lint.log')=='' and read('backend-types-final.log')==''
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc-final.log'));assert doc and (int(doc[1]),int(doc[2]))==(25555,1145)
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds-run.log').splitlines()==[target+' build passed' for target in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
for row in json.loads(read('target-dependencies.json')):assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==14 and all(row['status']=='terminal' for row in jobs)
for name in ['final-emulator','final-builds','final-tsdoc','targeted-lint','final-built-browser']:assert next(row for row in jobs if row['name']==name)['exitCode']==0
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True)
subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','measurements':measurements,'scope':'real service and engine under 200ms simulated document reads; emulator verifies real transaction semantics, not production internet latency','freshDeletionReadPerParticipantPerAttempt':True,'backendUnitTests':1586,'backendUnitSuites':129,'liveEmulatorTests':136,'liveEmulatorSuites':7,'latencyTests':8,'deletionOrderCases':4,'types':'passed','targetedLint':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'stableSourceInputs':len(source),'preservedBuildFiles':len(built),'ownedJobsTerminal':len(jobs),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
