from pathlib import Path
import difflib, hashlib, json, re, statistics
root=Path('/home/craig-beswetherick/Documents/riddle-quest')
p=root/'artifacts/classic-question-preparation-2026-10-05'
def read(name):return (p/name).read_text()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def manifest(folder):return {str(f.relative_to(folder)):digest(f) for f in sorted(folder.rglob('*')) if f.is_file()}
before=json.loads(read('source-before-verification.json'));after=json.loads(read('source-after-verification.json'));assert before==after
for name,h in after.items():assert digest(root/name)==h,name
assert len(after)==1511
comparisons={}
for name,count,failures in [('development',525,0),('production',525,0),('original-browser',18,4),('original-guidance',20,1),('guidance-fixed',20,0),('stable-original',19,2),('stable-fixed',19,0),('related-guidance-final',114,0)]:
 rows=json.loads(read(name+'/observations.json'));actual={'checks':len(rows),'failures':sum(r['actual']!=r['expected'] for r in rows)}
 assert actual=={'checks':count,'failures':failures},(name,actual);comparisons[name]=actual
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+93 skipped, 2820 passed',read('portal-unit.log'))
assert re.search(r'Test Suites:\s+35 passed',read('core-all-unit.log'))
assert re.search(r'Tests:\s+325 passed',read('core-all-unit.log'))
assert 'error TS' not in read('portal-types.log')
assert 'Unit, type and documentation gates passed' in read('gates.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
assert read('builds.log').splitlines()==[x+' build passed' for x in ['jest','facebook','reddit','youtube','netflix','yahoo']]
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log'))
assert re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert manifest(p/'built')==json.loads(read('built-sha256.json'))
assert manifest(p/'pre-stable-built')==json.loads(read('pre-stable-built-sha256.json'))
assert manifest(root/'artifacts/live-signal-watchdog-2026-10-05/built/jest')==json.loads(read('timing-original-sha256.json'))
timing={}
for variant in ['original','fixed']:
 samples=[]
 for i in range(6):
  rows=json.loads(read(f'verified-timing-{variant}-{i}/observations.json'));assert len(rows)==1
  r=rows[0];assert r['cpuRate']==12 and not r['domObserver'] and not r['longObserver'] and not r['guidanceSeen']
  assert r['held']==r['delivered']==1 and r['guidanceAfter']=='leaderboardFifthCorrectAnswer'
  samples.append(r['rafObservedMs'])
 timing[variant]={'samplesMs':samples,'medianMs':statistics.median(samples),'maximumMs':max(samples),'over100ms':sum(x>=100 for x in samples)}
assert timing['original']['over100ms']==5 and timing['fixed']['over100ms']==0
assert timing['fixed']['medianMs']<timing['original']['medianMs']
locks={}
for variant,expected in [('original',1),('fixed',0)]:
 rows=json.loads(read(f'verified-native-counter-{variant}/observations.json'));assert len(rows)==2
 assert all(len(r['nextLocks'])==expected and r['held']==r['delivered']==1 for r in rows)
 assert all(r['preparations']==(1 if variant=='fixed' else 0) for r in rows)
 locks[variant]={'samples':len(rows),'sharedLocksOnNext':[len(r['nextLocks']) for r in rows]}
ff=json.loads(read('firefox-verified-native.json'));assert len(ff)==3
assert ff[0]['reads']==ff[1]['reads'] and ff[0]['locks']==ff[1]['locks']==3
assert ff[1]['guesses']==ff[1]['preparations']==ff[1]['successorDeliveries']==1
assert ff[0]['successorDeliveries']==0 and 'face and hands' in ff[1]['heading']
assert ff[2]['profile']==ff[0]['before']
assert all(r['errors']==r['unhandled']==[] for r in ff)
config=json.loads((root/'packages/portal/package.json').read_text())['scripts']
assert 'pnpm test:classic-question-preparation:browser' in config['test:game-browser:playwright']
assert 'CLASSIC_PREPARATION_REACT_MODE=production' in config['test:classic-question-preparation:browser']
cleanup=json.loads(read('cleanup.json'));assert all(not Path(x).exists() for x in cleanup['privateBuildRootsRemoved'])
assert cleanup['firefoxOwnedTabsClosed'] and cleanup['firefoxRemainingPages']==['about:blank']
metadata=json.loads(read('target-dependencies.json'));assert len(metadata)==18
for row in metadata:assert not (root/row['original']).exists() and digest(root/row['preserved'])==row['sha256']
pairs=[('lifecycle','packages/portal/src/play/useHostRiddleLifecycle.ts'),('handlers','packages/portal/src/play/hostMessageHandlers.ts'),('bridge','packages/core/src/bridge/index.ts'),('session','packages/portal/src/play/HostedPlaySession.ts'),('gate','packages/portal/src/play/accountDeletionServiceGate.ts'),('host','packages/portal/src/play/PlayHostApp.tsx'),('frame','packages/portal/src/play/GameFrameApp.tsx'),('package','packages/portal/package.json'),('guidance','packages/portal/src/play/guidance/GuidanceOverlay.tsx'),('bridge-unit','packages/core/src/bridge/__tests__/bridge.test.ts'),('session-unit','packages/portal/src/play/__tests__/HostedPlaySession.test.ts'),('useHostRiddleLifecycle','packages/portal/src/play/__tests__/useHostRiddleLifecycle.test.ts'),('useHostRiddleRecovery','packages/portal/src/play/__tests__/useHostRiddleRecovery.test.ts')]
diff=''
for capture,source in pairs:
 assert (p/(capture+'.after.txt')).read_bytes()==(root/source).read_bytes()
 diff+=''.join(difflib.unified_diff(read(capture+'.before.txt').splitlines(True),read(capture+'.after.txt').splitlines(True),fromfile='a/'+source,tofile='b/'+source))
for capture,source in [('unit.final.ts','packages/portal/src/play/__tests__/classicQuestionPreparation.test.ts'),('owner-unit.final.ts','packages/portal/src/play/__tests__/classicQuestionPreparationOwner.test.ts'),('hook.final.ts','packages/portal/src/play/game/hooks/useClassicQuestionPreparation.ts'),('verifier.final.mjs','packages/portal/scripts/verify-classic-question-preparation-browser.mjs')]:
 assert (p/capture).read_bytes()==(root/source).read_bytes()
 diff+=''.join(difflib.unified_diff([],read(capture).splitlines(True),fromfile='/dev/null',tofile='b/'+source))
(p/'own.diff').write_text(diff)
summary={'goal':'active','browserComparisons':comparisons,'finalBrowserAssertions':1050,'relatedGuidanceAssertions':114,'portalUnits':{'suites':300,'passed':2820,'skipped':93},'coreUnits':{'suites':35,'passed':325},'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'passed':8,'latencyBudgetChanged':False},'stableSourceInputs':len(after),'preservedFinalBuildFiles':len(manifest(p/'built')),'timing':timing,'builtNativeLockCounters':locks,'verifiedFirefoxRecords':len(ff),'cleanup':cleanup}
(p/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['cleanup','browserComparisons']},indent=2))
