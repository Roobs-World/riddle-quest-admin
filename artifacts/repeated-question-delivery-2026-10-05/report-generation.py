from pathlib import Path
import hashlib,json,re
root=Path('/home/craig-beswetherick/Documents/riddle-quest');p=root/'artifacts/repeated-question-delivery-2026-10-05'
def read(name):return (p/name).read_text()
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(f for f in (root/name).rglob('*') if f.is_file())
files.update(f for f in (root/'packages/portal').iterdir() if f.is_file() and f.suffix not in ['.zip','.tsbuildinfo']);files.update(root/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(f.relative_to(root)):digest(f) for f in sorted(files)};assert current==json.loads(read('source-before-verification.json'))==json.loads(read('source-after-verification.json')) and len(current)==1514
results={}
for name,checks,failures,traces in [('red',14,0,0),('red-dom',16,2,2),('red-minimal',8,1,1),('first-fixed',24,0,3),('original-final-matrix',258,18,30),('development',258,0,30),('production',258,0,30),('related-ordering-development',180,0,0),('related-ordering-production',180,0,0),('related-classic-development',525,0,0),('related-classic-production',525,0,0),('related-buffered-development',420,0,0),('related-buffered-production',420,0,0)]:
 rows=json.loads(read(name+'/observations.json'));assertions=[row for row in rows if not row.get('diagnostic')];actual={'checks':len(assertions),'failures':sum(row['actual']!=row['expected'] for row in assertions),'traces':len(rows)-len(assertions)};assert actual=={'checks':checks,'failures':failures,'traces':traces},(name,actual);results[name]=actual
scenarios=['accepted-progress','duplicate-ready','fresh-ready','mode-fallback','new-session','pending-receipt','profile-refresh','reconcile','riddle-only','updated-hint']
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert sorted(set(row['scenario'] for row in rows))==scenarios;assert sorted(set((row['width'],row['height']) for row in rows))==[(390,568),(390,844),(1280,844)]
 for row in rows:
  if row.get('diagnostic') and row['scenario'] in ['duplicate-ready','fresh-ready','riddle-only','profile-refresh','pending-receipt','mode-fallback']:assert row['actual']==[]
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2849 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+106 passed, 106 total',read('focused-unit.log'))
assert '-   "P"' in read('unit-red.log') and '+   ""' in read('unit-red.log')
assert 'Expected: "classic"' in read('mode-control-red.log') and 'Received: "challenge"' in read('mode-control-red.log')
assert 'Unit, type and documentation gates passed' in read('gates.log') and 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[target+' build passed' for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (root/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(f.relative_to(p/'built')):digest(f) for f in sorted((p/'built').rglob('*')) if f.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==4 and all(row['errors']==row['unhandled']==[] for row in ff)
assert ff[0]['before']==ff[0]['after']=='P' and ff[0]['mutations']==[] and ff[0]['coins']=='777' and ff[0]['delivered']==4
assert ff[1]['draft']=='P' and ff[1]['mode']=='Classic' and ff[1]['mutations']==[]
assert ff[2]['before']==ff[2]['after']=='P' and len(ff[2]['mutations'])==2 and ff[2]['mutations'][0]['current']==''
assert ff[3]['draft']=='PI' and ff[3]['hint']=={'letter':'I','locked':True}
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryFinalBuildRemoved'] and cleanup['temporaryPrototypeBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==12 and cleanup['ownedFirefoxFixtureCachesRemoved']==2 and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
for scope in [p,p/'pre-mode-control']:
 assert not Path((scope/'build-root.txt').read_text().strip()).exists()
 rows=json.loads((scope/'target-dependencies.json').read_text());assert len(rows)==6
 for row in rows:assert not (root/row['original']).exists() and digest(root/row['preserved'])==row['sha256']
 fixture=next(json.loads(line) for line in (scope/'firefox-server.log').read_text().splitlines() if line.startswith('{"url":'));assert not Path(fixture['scratch']).exists()
for prefix,source in [('session','packages/portal/src/play/gameSession.ts'),('router','packages/portal/src/play/useGameMessageRouter.ts'),('types','packages/portal/src/play/gameSessionTypes.ts'),('router-test','packages/portal/src/play/__tests__/useGameMessageRouter.test.ts'),('package','packages/portal/package.json')]:assert (p/(prefix+'.after.txt')).read_bytes()==(root/source).read_bytes()
assert (p/'verifier.final.mjs').read_bytes()==(root/'packages/portal/scripts/verify-repeated-question-delivery-browser.mjs').read_bytes()
scripts=json.loads((root/'packages/portal/package.json').read_text())['scripts'];assert 'pnpm test:repeated-question-delivery:browser' in scripts['test:game-browser:playwright'] and 'QUESTION_REPEAT_REACT_MODE=production' in scripts['test:repeated-question-delivery:browser']
summary={'goal':'active','comparisons':results,'repeatedDeliveryAssertions':516,'relatedOrderingAssertions':360,'relatedClassicAssertions':1050,'relatedPaidRollbackAssertions':840,'browserAssertionsTotal':2766,'finalMutationTraces':60,'portalUnitTests':2849,'portalUnitSuites':300,'focusedUnitTests':106,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'firefoxRecords':len(ff),'cleanup':cleanup}
(p/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
