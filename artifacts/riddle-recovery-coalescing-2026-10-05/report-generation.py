from pathlib import Path
import hashlib,json,re
r=Path.cwd();e=r/'artifacts/riddle-recovery-coalescing-2026-10-05'
def read(name):return (e/name).read_text()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(p for p in (r/name).rglob('*') if p.is_file())
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')));files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(p.relative_to(r)):digest(p) for p in sorted(files)};assert current==json.loads(read('source-before.json')) and len(current)==1518
(e/'source-after.json').write_text(json.dumps(current,indent=2)+'\n')
comparisons={}
for name,checks,failures,samples in [('pre-overlay-control-baseline',7,2,1),('pre-overlay-control-guard',7,2,1),('red-browser',7,3,1),('observer-probe',7,0,1),('idle-timer-red',8,1,1),('timer-green',8,0,1),('expanded-probe',107,0,10),('baseline',107,42,10),('development',321,0,30),('production',321,0,30),('related-order-development',180,0,0),('related-order-production',180,0,0),('related-preparation-development',525,0,0),('related-preparation-production',525,0,0)]:
 rows=json.loads(read(name+'/observations.json'));metrics=[row for row in rows if not row.get('diagnostic')];result={'checks':len(metrics),'failures':sum(row['actual']!=row['expected'] for row in metrics),'samples':len(rows)-len(metrics)};assert result=={'checks':checks,'failures':failures,'samples':samples},(name,result);comparisons[name]=result
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert len(set(row['scenario'] for row in rows))==10;assert sorted(set((row['width'],row['height']) for row in rows))==[(390,568),(390,844),(1280,844)]
 for row in rows:
  if row.get('diagnostic') and row['scenario']=='online':
   trace=row['actual'];assert len(trace['recoveries'])==len(trace['reads'])==2 and trace['pendingTimers']==[]
   assert [x['delay'] for x in trace['timerSchedules'] if x['delay']>=1000]==[1000]
   assert len([x for x in trace['timerCallbacks'] if x['delay']==0])==0
baseline=json.loads(read('baseline/observations.json'));old=next(x['actual'] for x in baseline if x.get('diagnostic') and x['scenario']=='online');assert len(old['recoveries'])==21 and old['pendingTimers']==[30000] and len([x for x in old['timerCallbacks'] if x['delay']==0])==20
assert 'Expected number of calls: 2' in read('red-unit.log') and 'Received number of calls: 1' in read('red-unit.log')
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2856 passed',read('portal-unit.log'))
assert 'Unit, type and documentation gates passed' in read('gates.log') and 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[target+' build passed' for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):digest(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==5 and all(row['errors']==row['unhandled']==[] for row in ff)
assert ff[0]['readCount']==ff[0]['recoveryCount']==1 and ff[0]['signals']==20 and ff[0]['pendingTimers']==[] and len(ff[0]['timerCallbacks'])==1
assert ff[1]['reads'][1]['at']-ff[1]['failedAt']==1001 and ff[1]['pendingTimers']==[] and ff[1]['question']=='What has keys but cannot open doors?'
assert ff[2]['draft']=='P' and ff[2]['readCount']==2 and ff[2]['pendingTimers']==[]
assert ff[3]['held']['readCount']==ff[3]['held']['recoveryCount']==1 and len(ff[3]['reads'])==2 and ff[3]['pendingTimers']==[]
assert ff[4]['held']['readCount']==ff[4]['held']['recoveryCount']==1 and len(ff[4]['reads'])==3 and [x['delay'] for x in ff[4]['timerSchedules'] if x['delay']>=1000]==[1000,2000] and ff[4]['pendingTimers']==[]
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['ownedFixtureCachesRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
assert not Path(read('build-root.txt').strip()).exists()
for row in json.loads(read('target-dependencies.json')):assert not (r/row['original']).exists() and digest(r/row['preserved'])==row['sha256']
for name,f in [('lifecycle','packages/portal/src/play/useHostRiddleLifecycle.ts'),('recovery','packages/portal/src/play/__tests__/useHostRiddleRecovery.test.ts'),('package','packages/portal/package.json')]:assert (e/(name+'.after.txt')).read_bytes()==(r/f).read_bytes()
assert (e/'verifier.final.mjs').read_bytes()==(r/'packages/portal/scripts/verify-riddle-recovery-coalescing-browser.mjs').read_bytes()
jobs=json.loads(read('owned-jobs.json'));assert all(x['status']=='terminal' for x in jobs);assert next(x for x in jobs if x['name']=='initial-primary')['exitCode']==143 and next(x for x in jobs if x['name']=='primary-rerun')['exitCode']==0
summary={'goal':'active','comparisons':comparisons,'recoveryAssertions':642,'relatedAssertions':1410,'browserAssertionsTotal':2052,'observations':{'recoveryObserversBefore':21,'recoveryObserversAfter':1,'requestedRetryBackoffBeforeMs':30000,'requestedRetryBackoffAfterMs':1000,'emptyReconnectTimerCallbacksBefore':20,'emptyReconnectTimerCallbacksAfter':0,'scope':'actual client hook and native scheduler under injected full-host transport, not internet latency or total CPU'},'firefoxRecords':5,'firefoxRetryDelayMs':1001,'portalUnitTests':2856,'portalUnitSuites':300,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
