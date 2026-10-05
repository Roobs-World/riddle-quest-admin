from pathlib import Path
import hashlib,json,re
r=Path.cwd();e=r/'artifacts/live-recovery-wakeups-2026-10-05'
def read(name):return (e/name).read_text()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(p for p in (r/name).rglob('*') if p.is_file())
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')));files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(p.relative_to(r)):digest(p) for p in sorted(files)};assert current==json.loads(read('source-before.json'))==json.loads(read('source-after.json')) and len(current)==1517
comparisons={}
for name,checks,failures,samples in [('red',5,2,0),('lifecycle-probe',5,0,0),('expanded-lifecycle',82,6,11),('countdown-probe',14,3,2),('backoff-probe',14,3,2),('baseline-final',89,19,12),('green-probe',89,0,12),('development',267,0,36),('production',267,0,36),('related-scheduling-development',237,0,33),('related-scheduling-production',237,0,33),('related-retirement-development',57,0,0),('related-retirement-production',57,0,0),('related-countdown-development',354,0,0),('related-countdown-production',354,0,0)]:
 rows=json.loads(read(name+'/observations.json'));metrics=[row for row in rows if not row.get('diagnostic')];result={'checks':len(metrics),'failures':sum(row['actual']!=row['expected'] for row in metrics),'samples':len(rows)-len(metrics)};assert result=={'checks':checks,'failures':failures,'samples':samples},(name,result);comparisons[name]=result
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert len(set(row['scenario'] for row in rows))==14;assert sorted(set((row['width'],row['height']) for row in rows))==[(390,568),(390,844),(1280,844)]
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
assert [x['scenario'] for x in ff]==['online-poll','visible-command','countdown','backoff']
assert ff[0]['requests'][1]['at']-ff[0]['releases'][0]==1 and '3 / 10' in ff[0]['rival']
assert len([x for x in ff[1]['requests'] if x['action']=='guess'])==1 and '1 / 10' in ff[1]['player'] and '3 / 10' in ff[1]['rival']
assert ff[2]['waitingForPrompt'] and ff[2]['promptAvailable'] and len(ff[2]['requests'])==2
assert ff[3]['requests'][1]['at']-ff[3]['releases'][0]==2000 and '3 / 10' in ff[3]['rival']
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['ownedFixtureCachesRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
assert not Path(read('build-root.txt').strip()).exists()
for row in json.loads(read('target-dependencies.json')):assert not (r/row['original']).exists() and digest(r/row['preserved'])==row['sha256']
for name,f in [('live','packages/portal/src/play/race/LiveRaceGame.tsx'),('package','packages/portal/package.json')]:assert (e/(name+'.after.txt')).read_bytes()==(r/f).read_bytes()
assert (e/'verifier.final.mjs').read_bytes()==(r/'packages/portal/scripts/verify-live-recovery-wakeups-browser.mjs').read_bytes()
assert all(x['status']=='terminal' for x in json.loads(read('owned-jobs.json')))
summary={'goal':'active','comparisons':comparisons,'recoveryAssertions':534,'relatedAssertions':1296,'browserAssertionsTotal':1830,'firefoxRecords':4,'firefoxReconnectReadDelayMs':1,'firefoxBackoffReadDelayMs':2000,'portalUnitTests':2855,'portalUnitSuites':300,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
