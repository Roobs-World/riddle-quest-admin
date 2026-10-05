from pathlib import Path
import difflib,hashlib,json,re
root=Path('/home/craig-beswetherick/Documents/riddle-quest');p=root/'artifacts/session-assembly-retention-2026-10-05'
def read(name):return (p/name).read_text()
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
before=json.loads(read('source-before-verification.json'));after=json.loads(read('source-after-verification.json'));assert before==after and len(after)==1512
for name,h in after.items():assert digest(root/name)==h,name
results={}
for name,checks,failures in [('original-minimal',27,9),('original-control',30,9),('original-expanded',90,27),('current-only-probe',30,1),('weak-gate-probe',30,0),('original-final-matrix',132,45),('final-browser-probe',132,0),('development',132,0),('production',132,0),('related-classic-development',525,0),('related-classic-production',525,0)]:
 rows=json.loads(read(name+'/observations.json'));actual={'checks':len(rows),'failures':sum(r['actual']!=r['expected'] for r in rows)};assert actual=={'checks':checks,'failures':failures},(name,actual);results[name]=actual
for mode in ['development','production']:
 rows=json.loads(read(mode+'/observations.json'))
 assert sorted(set(r['count'] for r in rows))==[32,256,1024]
 assert sorted(set(r['scenario'] for r in rows))==['gated','gated-retained-caller','retained-caller','ungated']
 assert all(r['actual']==r['expected'] for r in rows)
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[x+' build passed' for x in ['jest','facebook','reddit','youtube','netflix','yahoo']]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log')
assert re.search(r'Test Suites:\s+15 skipped, 300 passed',read('portal-unit.log')) and re.search(r'Tests:\s+93 skipped, 2822 passed',read('portal-unit.log'))
assert re.search(r'Tests:\s+55 passed, 55 total',read('focused-unit.log'))
assert 'error TS' not in read('portal-types.log') and 'Unit, type and documentation gates passed' in read('gates.log')
doc=re.search(r'TSDoc audit passed: (\d+) declarations are documented across (\d+) files',read('tsdoc.log'));assert doc
assert re.search(r'Test Suites:\s+3 passed, 3 total',read('built-browser.log')) and re.search(r'Tests:\s+8 passed, 8 total',read('built-browser.log'))
hashes={str(f.relative_to(p/'built')):digest(f) for f in sorted((p/'built').rglob('*')) if f.is_file()};assert hashes==json.loads(read('built-sha256.json'))
ff=json.loads(read('firefox-native.json'));assert len(ff)==2 and all(r['errors']==r['unhandled']==[] for r in ff)
assert ff[0]['current']=='255' and ff[0]['older']=={'success':True,'productId':'coins','generation':0} and ff[0]['refreshes']==256 and ff[0]['reused']
assert ff[1]['current']=='3' and ff[1]['oldError']=='retired-gate' and not ff[1]['oldAdmission'] and ff[1]['currentAdmission']
config=json.loads((root/'packages/portal/package.json').read_text())['scripts'];assert 'pnpm test:session-assembly-retention:browser' in config['test:game-browser:playwright'] and 'SESSION_RETENTION_REACT_MODE=production' in config['test:session-assembly-retention:browser']
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and not Path(read('build-root.txt').strip()).exists()
assert cleanup['ownedFirefoxTabsClosed'] and cleanup['remainingFirefoxPages']==['about:blank']
metadata=json.loads(read('target-dependencies.json'));assert len(metadata)==6
for row in metadata:assert not (root/row['original']).exists() and digest(root/row['preserved'])==row['sha256']
diff=''
for capture,source in [('session','packages/portal/src/play/HostedPlaySession.ts'),('unit','packages/portal/src/play/__tests__/HostedPlaySession.test.ts'),('package','packages/portal/package.json')]:
 assert (p/(capture+'.after.txt')).read_bytes()==(root/source).read_bytes()
 diff+=''.join(difflib.unified_diff(read(capture+'.before.txt').splitlines(True),read(capture+'.after.txt').splitlines(True),fromfile='a/'+source,tofile='b/'+source))
source='packages/portal/scripts/verify-session-assembly-retention-browser.mjs';assert (p/'verifier.final.mjs').read_bytes()==(root/source).read_bytes();diff+=''.join(difflib.unified_diff([],read('verifier.final.mjs').splitlines(True),fromfile='/dev/null',tofile='b/'+source));(p/'own.diff').write_text(diff)
summary={'goal':'active','comparisons':results,'retentionAssertions':264,'relatedGameplayAssertions':1050,'browserAssertionsTotal':1314,'refreshCounts':[32,256,1024],'baselineRootedCallbacksAt1024':1024,'finalRootedCallbacksAt1024':1,'retainedCallerControl':{'whileHeld':2,'afterRelease':1},'portalUnitTests':2822,'portalUnitSuites':300,'focusedUnitTests':55,'types':'passed','tsdocDeclarations':int(doc[1]),'tsdocFiles':int(doc[2]),'sixBuilds':'passed','youtube':'fixture','builtBrowser':{'suites':3,'tests':8,'latencyBudgetChanged':False},'stableSourceInputs':len(after),'preservedBuildFiles':len(hashes),'firefoxRecords':len(ff),'cleanup':cleanup};(p/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['comparisons','cleanup']},indent=2))
