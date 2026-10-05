from pathlib import Path
import hashlib,json,re
root=Path('/home/craig-beswetherick/Documents/riddle-quest');p=root/'artifacts/question-load-ordering-2026-10-05'
def read(name):return (p/name).read_text()
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:
 files.update(f for f in (root/name).rglob('*') if f.is_file())
files.update(f for f in (root/'packages/portal').iterdir() if f.is_file() and f.suffix not in ['.zip','.tsbuildinfo'])
files.update(root/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(f.relative_to(root)):digest(f) for f in sorted(files)}
assert current==json.loads(read('source-before-verification.json'))==json.loads(read('source-after-verification.json')) and len(current)==1513
results={}
for name,checks,failures in [('red',9,2),('first-fixed',9,0),('original-final-matrix',180,27),('development',180,0),('production',180,0),('related-classic-development',525,0),('related-classic-production',525,0),('related-buffered-development',420,0),('related-buffered-production',420,0)]:
 rows=json.loads(read(name+'/observations.json'));actual={'checks':len(rows),'failures':sum(r['actual']!=r['expected'] for r in rows)};assert actual=={'checks':checks,'failures':failures},(name,actual);results[name]=actual
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert sorted(set(x['scenario'] for x in rows))==['late-failure','late-success','obsolete-preview','obsolete-reconcile','retirement','success-before-newer'];assert sorted(set((x['width'],x['height']) for x in rows))==[(390,568),(390,844),(1280,844)]
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2828 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+55 passed, 55 total',read('focused-unit.log'))
assert 'Expected: false' in read('unit-red.log') and 'Received: true' in read('unit-red.log')
assert 'Unit, type and documentation gates passed' in read('gates.log') and 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[target+' build passed' for target in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (root/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(f.relative_to(p/'built')):digest(f) for f in sorted((p/'built').rglob('*')) if f.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==2 and all(row['errors']==row['unhandled']==[] and row['alerts']==0 for row in ff)
assert ff[0]['before']==ff[0]['after']=='C' and len(ff[0]['delivered'])==2 and ff[0]['delivered'][-1]['token'].endswith('000003')
assert ff[1]['before']==ff[1]['after']=='CL' and ff[1]['deliveredBefore']==ff[1]['deliveredAfter']==3 and ff[1]['readsBefore']==ff[1]['readsAfter']==5
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and not Path(read('build-root.txt').strip()).exists() and cleanup['firefoxFixtureCacheRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
metadata=json.loads(read('target-dependencies.json'));assert len(metadata)==6
for row in metadata:assert not (root/row['original']).exists() and digest(root/row['preserved'])==row['sha256']
for prefix,source in [('lifecycle','packages/portal/src/play/useHostRiddleLifecycle.ts'),('recovery-test','packages/portal/src/play/__tests__/useHostRiddleRecovery.test.ts'),('package','packages/portal/package.json')]:assert (p/(prefix+'.after.txt')).read_bytes()==(root/source).read_bytes()
assert (p/'verifier.final.mjs').read_bytes()==(root/'packages/portal/scripts/verify-question-load-ordering-browser.mjs').read_bytes()
scripts=json.loads((root/'packages/portal/package.json').read_text())['scripts'];assert 'pnpm test:question-load-ordering:browser' in scripts['test:game-browser:playwright'] and 'QUESTION_ORDER_REACT_MODE=production' in scripts['test:question-load-ordering:browser']
summary={'goal':'active','comparisons':results,'orderingBrowserAssertions':360,'relatedClassicAssertions':1050,'relatedPaidRollbackAssertions':840,'browserAssertionsTotal':2250,'portalUnitTests':2828,'portalUnitSuites':300,'focusedUnitTests':55,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'firefoxRecords':len(ff),'cleanup':cleanup}
(p/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
