from pathlib import Path
import hashlib,json,re
r=Path.cwd();e=r/'artifacts/live-unavailable-poll-retirement-2026-10-05'
def read(name):return (e/name).read_text()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(p for p in (r/name).rglob('*') if p.is_file())
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')));files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(p.relative_to(r)):digest(p) for p in sorted(files)};assert current==json.loads(read('source-before.json')) and len(current)==1517
(e/'source-after.json').write_text(json.dumps(current,indent=2)+'\n')
comparisons={}
for name,checks,failures,samples in [('red',13,2,0),('red-production',13,2,0),('guard-probe',13,0,0),('baseline',14,3,0),('development',369,0,0),('production',369,0,0),('related-recovery-development',267,0,36),('related-recovery-production',267,0,36),('related-retirement-development',57,0,0),('related-retirement-production',57,0,0)]:
 rows=json.loads(read(name+'/observations.json'));metrics=[row for row in rows if not row.get('diagnostic')];result={'checks':len(metrics),'failures':sum(row['actual']!=row['expected'] for row in metrics),'samples':len(rows)-len(metrics)};assert result=={'checks':checks,'failures':failures,'samples':samples},(name,result);comparisons[name]=result
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert len(set(row['scenario'] for row in rows))==9;assert sorted(set((row['width'],row['height']) for row in rows))==[(390,568),(390,844),(1280,844)]
 terminal=[x for x in rows if x['name']=='unavailable invitation causes no idle polling callbacks'];assert len(terminal)==6 and all(x['actual']==0 for x in terminal)
red=json.loads(read('red/observations.json'));assert next(x['actual'] for x in red if x['name']=='unavailable invitation causes no idle polling callbacks')==58
redprod=json.loads(read('red-production/observations.json'));assert next(x['actual'] for x in redprod if x['name']=='unavailable invitation causes no idle polling callbacks')==58
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2855 passed',read('portal-unit.log'))
assert 'Unit, type and documentation gates passed' in read('gates.log') and 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[target+' build passed' for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):digest(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==3 and all(row['errors']==row['unhandled']==[] for row in ff)
assert ff[0]['held']=={'confirmation':True,'deadlineCount':1} and ff[0]['screen']=='multiplayer_live_invitation_unavailable' and ff[0]['message']=='This invitation has expired.'
assert ff[0]['pollTimers']==ff[0]['pollTicks']==ff[0]['deadlines']==0 and len(ff[0]['joins'])==ff[0]['confirmations']==1 and ff[0]['updates']==ff[0]['grants']==ff[0]['events']==[]
assert ff[1]['pollTimers']==ff[1]['pollTicks']==ff[1]['deadlines']==0 and ff[1]['joinCount']==ff[1]['confirmationCount']==1 and ff[1]['updates']==[]
assert ff[2]['introAvailable'] and ff[2]['pollTimers']==ff[2]['deadlines']==ff[2]['leaveCount']==0
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['ownedFixtureCachesRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
assert not Path(read('build-root.txt').strip()).exists()
for row in json.loads(read('target-dependencies.json')):assert not (r/row['original']).exists() and digest(r/row['preserved'])==row['sha256']
for after,f in [('live.after.txt','packages/portal/src/play/race/LiveRaceGame.tsx'),('confirmation.after.mjs','packages/portal/scripts/verify-live-confirmation-retirement-browser.mjs')]:assert (e/after).read_bytes()==(r/f).read_bytes()
assert all(x['status']=='terminal' for x in json.loads(read('owned-jobs.json')))
previous=json.loads((r/'artifacts/live-recovery-wakeups-2026-10-05/verification-summary.json').read_text());assert previous['browserAssertionsTotal']==1830 and previous['sixBuilds']=='passed'
summary={'goal':'active','comparisons':comparisons,'confirmationAssertions':738,'relatedAssertions':648,'browserAssertionsTotal':1386,'timerObservation':{'beforeCallbacks':58,'afterCallbacks':0,'observationMs':1200,'scope':'owned polling callbacks in the minimized injected invitation fixture; not total CPU'},'firefoxRecords':3,'portalUnitTests':2855,'portalUnitSuites':300,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'earlierRecoveryPassAssertions':1830,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
