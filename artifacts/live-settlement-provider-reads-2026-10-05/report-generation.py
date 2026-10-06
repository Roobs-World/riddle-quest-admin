from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/live-settlement-provider-reads-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert source==json.loads(read('source-report.json')) and len(source)==2343
def traces(name):
 rows=[json.loads(line.strip()) for line in read(name).splitlines() if re.fullmatch(r'\s*\{"provider":.*\}\s*',line)]
 assert len(rows)==15
 return {(x['provider'],x['winner'],x['retryDeletion'],x['sourceReadFails']):x for x in rows}
a=traces('red.log');b=traces('final-latency-traces.log');measurements=[]
for key,after in b.items():
 provider,winner,retry,fails=key;factor=2 if retry else 1;before=a[key]
 assert len(before['reads'])==(8+(winner==1))*factor
 assert len(after['reads'])==(8+(provider=='facebook' and winner==1))*factor
 assert after['elapsedMs']==800*factor
 assert after['reads'].count('liveRaceTickets/'+'b'*64)==(factor if provider=='facebook' and winner==1 else 0)
 for subject in ['a','b']:assert after['reads'].count('jestAccountDeletionTombstones/'+provider+'_'+subject*40)==factor
 measurements.append({'provider':provider,'winnerSeat':winner,'retryDeletion':retry,'sourceReadFails':fails,'beforeReads':len(before['reads']),'afterReads':len(after['reads']),'afterMs':after['elapsedMs']})
assert re.search(r'Tests:\s+6 failed, 9 passed, 15 total',read('red.log'))
assert re.search(r'Tests:\s+19 passed, 19 total',read('final-latency-traces.log'))
assert re.search(r'Test Suites:\s+129 passed, 129 total',read('backend-units.log')) and re.search(r'Tests:\s+1597 passed, 1597 total',read('backend-units.log'))
assert re.search(r'Test Suites:\s+10 passed, 10 total',read('live-integrations.log')) and re.search(r'Tests:\s+218 passed, 218 total',read('live-integrations.log'))
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
assert read('backend-lint.log')==read('backend-types.log')==''
assert '25557 declarations are documented across 1145 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==5 and all(row['status']=='terminal' and row['exitCode']==0 for row in jobs)
for before,current in [('service-after.ts','firebase-functions/src/race/raceLiveService.ts'),('test-after.ts','firebase-functions/src/__tests__/race/raceLiveSettlementLatency.test.ts')]:assert (e/before).read_bytes()==(r/current).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','providerCases':15,'measurements':measurements,'scope':'actual service and scoring engine with 200ms simulated reads; real emulator gates verify provider delivery, privacy and transaction behavior','unnecessaryReadFailuresRemovedFor':['jest','reddit'],'facebookOriginalContextPreserved':True,'freshDeletionReadPerParticipantPerAttempt':True,'backendUnitTests':1597,'backendUnitSuites':129,'liveEmulatorTests':218,'liveEmulatorSuites':10,'focusedTests':19,'types':'passed','targetedLint':'passed','tsdocDeclarations':25557,'tsdocFiles':1145,'sixBuilds':'passed','youtube':'fixture','builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'stableSourceInputs':2343,'preservedBuildFiles':1300,'ownedJobsTerminal':5,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='measurements'},indent=2))
