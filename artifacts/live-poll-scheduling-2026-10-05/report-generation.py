from pathlib import Path
import hashlib,json,re
r=Path('/home/craig-beswetherick/Documents/riddle-quest');e=r/'artifacts/live-poll-scheduling-2026-10-05'
def read(name):return (e/name).read_text()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(p for p in (r/name).rglob('*') if p.is_file())
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')));files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(p.relative_to(r)):digest(p) for p in sorted(files)};assert current==json.loads(read('source-before.json'))==json.loads(read('source-after.json')) and len(current)==1516
comparisons={}
for name,checks,failures,samples in [('red',6,1,0),('first-fixed',6,0,0),('early-timer-red',8,1,2),('corrected-probe',79,0,11),('original',79,15,11),('development',237,0,33),('production',237,0,33),('related-retirement-development',57,0,0),('related-retirement-production',57,0,0)]:
 rows=json.loads(read(name+'/observations.json'));metrics=[row for row in rows if not row.get('diagnostic')];result={'checks':len(metrics),'failures':sum(row['actual']!=row['expected'] for row in metrics),'samples':len(rows)-len(metrics)};assert result=={'checks':checks,'failures':failures,'samples':samples},(name,result);comparisons[name]=result
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert len(set(row['scenario'] for row in rows))==10;assert sorted(set((row['width'],row['height']) for row in rows))==[(390,568),(390,844),(1280,844)]
 healthy=[row['actual'] for row in rows if row.get('diagnostic') and row['scenario']=='healthy'];assert healthy==[0,0,0]
 watchdog=[row['actual'] for row in rows if row.get('diagnostic') and row['name']=='watchdog native timer trace'];assert len(watchdog)==3 and all(len(trace)==1 for trace in watchdog)
original=json.loads(read('original/observations.json'));assert next(row['actual'] for row in original if row.get('diagnostic') and row['scenario']=='healthy')==2;assert len(next(row['actual'] for row in original if row.get('diagnostic') and row['name']=='watchdog native timer trace'))==10
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2855 passed',read('portal-unit.log'))
assert 'Unit, type and documentation gates passed' in read('gates.log') and 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[target+' build passed' for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):digest(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==4 and all(row['errors']==row['unhandled']==[] for row in ff)
assert ff[0]['held'] and ff[0]['timers']==ff[0]['idleTicks']==0 and len(ff[0]['guesses'])==1
assert ff[1]['guessCount']==1 and ff[1]['timers']==1 and '1 / 10' in ff[1]['progress']
assert ff[2]['count']==2 and ff[2]['retryMs']==2001 and len(set(ff[2]['receiptIds']))==1 and ff[2]['timers']==1 and '1 / 10' in ff[2]['progress']
assert ff[3]['observations']==2 and ff[3]['timers']==1
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==12 and cleanup['ownedFixtureCachesRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank'];assert cleanup['builtBrowserInitialHandle']=='missing after interruption, no matching OS process, empty output; replaced only after stop was confirmed'
for scope in [e,e/'pre-hidden-cadence-control']:
 assert not Path((scope/'build-root.txt').read_text().strip()).exists()
 metadata=json.loads((scope/'target-dependencies.json').read_text());assert len(metadata)==6
 for row in metadata:assert not (r/row['original']).exists() and digest(r/row['preserved'])==row['sha256']
fixture=next(json.loads(line) for line in read('firefox-server.log').splitlines() if line.startswith('{"url":'));assert not Path(fixture['scratch']).exists()
for name,f in [('live','packages/portal/src/play/race/LiveRaceGame.tsx'),('signals','packages/portal/src/play/race/hooks/useLiveRaceSignals.ts'),('package','packages/portal/package.json')]:assert (e/(name+'.after.txt')).read_bytes()==(r/f).read_bytes()
assert (e/'verifier.final.mjs').read_bytes()==(r/'packages/portal/scripts/verify-live-poll-scheduling-browser.mjs').read_bytes()
scripts=json.loads((r/'packages/portal/package.json').read_text())['scripts'];assert 'pnpm test:live-poll-scheduling:browser' in scripts['test:game-browser:playwright'] and 'LIVE_SCHEDULE_REACT_MODE=production' in scripts['test:live-poll-scheduling:browser'];assert 'test:race-hidden-scheduling:browser' not in scripts
inactive=r/'artifacts/race-hidden-scheduling-2026-10-05';assert (r/'packages/portal/src/play/race/hooks/useRaceSession.ts').read_bytes()==(inactive/'hook.before.txt').read_bytes();assert (r/'packages/portal/scripts/verify-race-session-resources-browser.mjs').read_bytes()==(inactive/'resources.before.txt').read_bytes();assert not (r/'packages/portal/scripts/verify-race-hidden-scheduling-browser.mjs').exists()
summary={'goal':'active','comparisons':comparisons,'liveSchedulingAssertions':474,'relatedRetirementAssertions':114,'browserAssertionsTotal':588,'pollingCallbackObservation':{'originalWatchdogCallbacks':10,'finalWatchdogCallbacks':1,'reductionPercent':90,'scope':'polling scheduler callbacks in injected fixture, not total CPU'},'firefoxRecords':4,'nativeRetryMs':2001,'portalUnitTests':2855,'portalUnitSuites':300,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'inactivePrototype':'discarded','cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
