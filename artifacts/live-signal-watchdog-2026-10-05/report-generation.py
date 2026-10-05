from pathlib import Path
import difflib, hashlib, json, re
root=Path('/home/craig-beswetherick/Documents/riddle-quest')
p=root/'artifacts/live-signal-watchdog-2026-10-05'
def read(name): return (p/name).read_text()
expected={'original-browser':(17,6),'original-browser-expanded':(104,24),'complete-browser-probe':(83,0),'final-browser-probe':(104,0),'development':(312,0),'production':(312,0),'related-development':(132,0),'related-production':(132,0)}
results={}
for name,(checks,failures) in expected.items():
 rows=json.loads(read(name+'/observations.json'))
 results[name]={'checks':len(rows),'failures':sum(row['actual']!=row['expected'] for row in rows)}
 assert results[name]=={'checks':checks,'failures':failures},name
before=json.loads(read('source-before-verification.json'))
after=json.loads(read('source-after-verification.json'))
assert before==after
for name,digest in after.items(): assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
# Earlier windows differ solely in test documentation; no runtime or verifier input drifted.
for name in ['source-before-doc-fix.json','source-before-inline-doc-fix.json']:
 old=json.loads(read(name));assert old.keys()==after.keys()
 assert [key for key in after if old[key]!=after[key]]==['packages/portal/src/play/__tests__/firebaseLiveRaceRecovery.test.ts']
diff=''
for capture,source in [('signals','packages/portal/src/play/firebaseLiveRaceSignals.ts'),('package','packages/portal/package.json')]:
 assert (p/(capture+'.after.txt')).read_bytes()==(root/source).read_bytes()
 diff+=''.join(difflib.unified_diff(read(capture+'.before.txt').splitlines(True),read(capture+'.after.txt').splitlines(True),fromfile='a/'+source,tofile='b/'+source))
for capture,source in [('unit.final.ts','packages/portal/src/play/__tests__/firebaseLiveRaceRecovery.test.ts'),('verifier.final.mjs','packages/portal/scripts/verify-live-signal-watchdog-browser.mjs')]:
 assert (p/capture).read_bytes()==(root/source).read_bytes()
 diff+=''.join(difflib.unified_diff([],read(capture).splitlines(True),fromfile='/dev/null',tofile='b/'+source))
(p/'own.diff').write_text(diff)
assert re.search(r'Test Suites:\s+15 skipped, 298 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+93 skipped, 2769 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+14 passed, 14 total',read('final-sdk.log'))
assert 'error TS' not in read('portal-types.log')
assert 'Unit, type and documentation gates passed' in read('gates.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for name,failures,passes in [('original-sdk.log',1,0),('original-sdk-repeat.log',1,0),('original-sdk-control.log',1,1),('original-expanded.log',5,2),('final-response-probe.log',4,3),('queued-deadline-probe.log',1,7)]:
 log=read(name);assert f'{failures} failed' in log
 if passes: assert f'{passes} passed' in log
for row in json.loads(read('sdk-input.json')): assert hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()==row['sha256']
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
assert read('builds.log').splitlines()==[target+' build passed' for target in targets]
for target in targets: assert 'artifact audit passed' in read('build-'+target+'.log'),target
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log'))
assert re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
ff=json.loads(read('firefox-native.json'));assert len(ff)==5
assert all(row['errors']==row['unhandled']==[] for row in ff)
assert len(ff[0]['streams'])==1 and not ff[0]['streams'][0]['aborted'] and ff[0]['health']==False and ff[0]['cadence']==500
assert len(ff[1]['streams'])==2 and ff[1]['streams'][0]['aborted'] and ff[1]['health']==True and ff[1]['cadence']==5000
assert ff[2]['letters']==list('piano') and ff[2]['guessCalls']==0
assert ff[3]['guessCalls']==1 and '1 / 10' in ff[3]['progress']
assert ff[4]['retired'] and ff[4]['before']==ff[4]['after'] and ff[4]['allAborted'] and ff[4]['leaveCount']==1
manifest=json.loads((root/'packages/portal/package.json').read_text())
assert 'pnpm test:live-signal-watchdog:browser' in manifest['scripts']['test:game-browser:playwright']
assert 'LIVE_WATCHDOG_REACT_MODE=production' in manifest['scripts']['test:live-signal-watchdog:browser']
build_hashes={str(f.relative_to(p/'built')):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((p/'built').rglob('*')) if f.is_file()}
assert build_hashes==json.loads(read('built-sha256.json'))
assert not Path(read('build-root.txt').strip()).exists()
cleanup=json.loads(read('cleanup.json'));cleanup['jobs']['finalGates']={'handle':86816,'exit':0};(p/'cleanup.json').write_text(json.dumps(cleanup,indent=2)+'\n')
assert cleanup['temporaryBuildRemoved'] and cleanup['fixtureCachesRemoved']
summary={'comparisons':results,'focusedBrowserAssertions':624,'relatedBrowserAssertions':264,'browserAssertionsTotal':888,'focusedJourneys':36,'viewports':[[390,568],[390,844],[1280,844]],'builtBrowser':{'suites':3,'tests':8,'failures':0,'latencyThresholdChanged':False},'unitTests':2769,'unitSuites':298,'focusedUnitTests':14,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtubeBuild':'fixture','stableSourceInputs':len(after),'runtimeSourceDelta':[],'earlierTestOnlyDocumentationDrift':True,'firefoxRecords':len(ff),'preservedBuildFiles':len(build_hashes),'cleanup':cleanup,'goal':'active'}
(p/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({key:value for key,value in summary.items() if key not in ['cleanup','comparisons']},indent=2))
