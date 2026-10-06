from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-validation-work-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2365 and source==json.loads(read('source-report.json'))
before=json.loads(read('runtime-before.json'));after=json.loads(read('runtime-after.json'))
assert [row['kind'] for row in before]==[row['kind'] for row in after]==['guess','prompt','preload']
for row in before:assert row['success'] is False and row['inputUnits']==row['normalizedUnits']==row['segmentedUnits']==4096
for row in after:assert row['success'] is False and row['inputUnits']==4096 and row['normalizedUnits']==row['segmentedUnits']==0
assert re.search(r'Tests:\s+6 failed, 7 passed, 13 total',read('red-unit.log'))
counts('green-focused.log',26,2);counts('core-units.log',351,37)
counts('backend-units.log',1669,134);counts('live-integrations.log',401,27);counts('node22-sdk.log',10,1)
counts('portal-focused.log',37,4);counts('built-browser.log',8,3)
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
for name in ['backend-types.log','backend-lint.log']:assert read(name)=='',name
assert read('portal-types.log')==read('core-types.log').splitlines(keepends=True)[0] and '[WARN] Unsupported engine:' in read('portal-types.log')
assert 'tsc -p tsconfig.json --noEmit' in read('core-types.log')
assert '26056 declarations are documented across 1167 files' in read('tsdoc.log')
assert 'Prepared deploy build artifact' in read('prepare.log')
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] Unicode SDK compatibility' in read('node22-sdk.log')
for path,expected in json.loads(read('core-copies.json')).items():assert sha(r/path)==expected,path
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert read('builds-run.log').splitlines()==[target+' build passed' for target in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
assert 'expect(bufferedTransitionMs).toBeLessThan(100);' in (r/'packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts').read_text()
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert built==json.loads(read('built-sha256.json')) and len(built)==1300
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==18 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']};assert resolved=={'core-lint-unconfigured'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'Race guess and current/preloaded evaluation answer refinements reject text above the existing 128-unit bound before Unicode normalization or segmentation.','reproduction':{'inputUnits':4096,'schemas':['guess','prompt','preload'],'rejectedBeforeAndAfter':True,'normalizedUnitsBeforePerSchema':4096,'normalizedUnitsAfterPerSchema':0,'segmentedUnitsBeforePerSchema':4096,'segmentedUnitsAfterPerSchema':0},'matchingRedCases':6,'newCoreCases':13,'controls':'Oversized ASCII and one-grapheme combining sequences perform no normalization/segmentation; 128-unit seven-grapheme originals pass without rewriting; eight-slot bounded strings fail; guess trimming precedes the bound. Existing Unicode SDK gameplay verifies hints, original evaluations, scoring, replay and balances.','limitations':'No end-to-end latency claim. Trimming still scans guess input. In-bound text retains the existing Unicode segmentation semantics. Oversized text can gain the generic refinement issue in addition to its existing raw-length failure.','coreTests':351,'coreSuites':37,'backendUnitTests':1669,'backendUnitSuites':134,'emulatorTests':401,'emulatorSuites':27,'pinnedNode22UnicodeSdkTests':10,'portalFocusedTests':37,'portalFocusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':['core','backend','portal'],'downstreamBackendLint':'passed','coreLint':'No configured core lint command; initial root invocation failure is documented. Core types and tests passed.','tsdocDeclarations':26056,'tsdocFiles':1167,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2365,'preservedBuildFiles':1300,'ownedJobsTerminal':18,'resolvedToolingFailures':sorted(resolved),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
