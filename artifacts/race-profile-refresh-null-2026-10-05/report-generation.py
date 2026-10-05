from pathlib import Path
import hashlib,json,re
r=Path('/home/craig-beswetherick/Documents/riddle-quest');e=r/'artifacts/race-profile-refresh-null-2026-10-05'
def read(name):return (e/name).read_text()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=set()
for name in ['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']:files.update(p for p in (r/name).rglob('*') if p.is_file())
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')));files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
current={str(p.relative_to(r)):digest(p) for p in sorted(files)};assert current==json.loads(read('source-before.json'))==json.loads(read('source-after.json')) and len(current)==1515
comparisons={}
for name,checks,failures in [('red',8,2),('first-fixed',8,0),('firebase-red',16,2),('first-fixed-both',32,0),('expanded-probe',220,0),('original',660,54),('development',660,0),('production',660,0)]:
 rows=json.loads(read(name+'/observations.json'));result={'checks':len(rows),'failures':sum(x['actual']!=x['expected'] for x in rows)};assert result=={'checks':checks,'failures':failures},(name,result);comparisons[name]=result
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'));assert sorted(set(x['provider'] for x in rows))==['firebase','reddit'];assert sorted(set(x['balance'] for x in rows))==[275,777];assert sorted(set((x['width'],x['height']) for x in rows))==[(390,568),(390,844),(1280,844)];assert len(set(x['scenario'] for x in rows))==7
for mode in ['development','production']:assert read('related-'+mode+'.log').count('Profile refresh ownership passed: ')==20
assert 'PASS: 6 live-result balance/profile return cases' in read('live-profile.log')
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2855 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+28 passed, 28 total',read('firebase-focused-unit.log'))
assert 'error TS' not in read('portal-types.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):digest(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
ff=json.loads(read('firefox-native.json'));assert len(ff)==3 and all(x['errors']==x['unhandled']==[] for x in ff)
for row,balance in zip(ff[:2],[777,275]):assert row['balance']==balance and row['output']==str(balance) and row['followups']==[True] and row['replacements']==[]
assert ff[2]['balance']==777 and ff[2]['retiredOutputCount']==0 and ff[2]['followups']==[True,False] and len(ff[2]['replacements'])==1 and ff[2]['replacements'][0]['coins']==777
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['ownedFixtureCachesRemoved'] and cleanup['relatedTemporaryHarnessRemoved'] and cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
assert not Path(read('build-root.txt').strip()).exists()
metadata=json.loads(read('target-dependencies.json'));assert len(metadata)==6
for row in metadata:assert not (r/row['original']).exists() and digest(r/row['preserved'])==row['sha256']
fixture=next(json.loads(line) for line in read('firefox-server.log').splitlines() if line.startswith('{"url":'));assert not Path(fixture['scratch']).exists()
for name,f in [('coordination','packages/portal/src/play/useHostRaceCoordination.ts'),('firebase','packages/portal/src/play/firebaseServices.ts'),('firebase-unit','packages/portal/src/play/__tests__/firebaseServiceOwnership.test.ts'),('package','packages/portal/package.json')]:assert (e/(name+'.after.txt')).read_bytes()==(r/f).read_bytes()
assert (e/'verifier.final.mjs').read_bytes()==(r/'packages/portal/scripts/verify-race-profile-refresh-null-browser.mjs').read_bytes()
scripts=json.loads((r/'packages/portal/package.json').read_text())['scripts'];assert 'pnpm test:race-profile-refresh-null:browser' in scripts['test:game-browser:playwright'] and 'RACE_NULL_REACT_MODE=production' in scripts['test:race-profile-refresh-null:browser']
summary={'goal':'active','comparisons':comparisons,'profileBrowserAssertions':1320,'relatedOwnershipCases':40,'relatedLiveProfileCases':6,'firefoxRecords':3,'focusedUnits':28,'portalUnits':2855,'portalUnitSuites':300,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'bufferedTransitionBudgetMs':100,'latencyBudgetChanged':False},'stableSourceInputs':len(current),'preservedBuildFiles':len(built),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
