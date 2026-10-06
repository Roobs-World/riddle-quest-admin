from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-unicode-cells-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2377 and source==json.loads(read('source-report.json'))
before=json.loads(read('runtime-before.json'));after=json.loads(read('runtime-after.json'))
assert before['locale']==after['locale']=='hi' and before['slotUnits']==after['slotUnits']==[1,9]
for key in ['validGuess','evaluationAccepted','requestAccepted']:assert before[key] is after[key] is True
for key in ['firstHintAccepted','feedbackAccepted','historyAccepted','currentHintAccepted']:assert before[key] is False and after[key] is True
assert re.search(r'Tests:\s+19 failed, 4 passed, 23 total',read('red-core-final.log'))
assert re.search(r'Tests:\s+11 failed, 11 total',read('red-emulator-final.log'))
assert re.search(r'Tests:\s+1 failed, 60 passed, 61 total',read('red-draft.log'))
assert re.search(r'Tests:\s+1 failed, 61 passed, 62 total',read('draft-normalization-probe.log'))
counts('green-emulator-final.log',11,1);counts('core-units.log',374,38)
counts('backend-units.log',1669,134);counts('live-integrations.log',412,28);counts('node22-sdk.log',11,1)
counts('portal-focused.log',121,7);counts('green-draft-final.log',62,1);counts('built-browser.log',8,3)
assert 'Script exited successfully (code 0)' in read('emulator-run.log') and 'Stopping Firestore Emulator' in read('emulator-run.log')
for name in ['backend-types.log','backend-lint.log']:assert read(name)=='',name
assert read('portal-types.log')==''
assert '[WARN] Unsupported engine:' in read('core-types.log')
assert 'tsc -p tsconfig.json --noEmit' in read('core-types.log')
assert '26100 declarations are documented across 1170 files' in read('tsdoc.log')
assert 'Prepared deploy build artifact' in read('prepare-fixed.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==31 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']};assert resolved=={'red-launch-preflight','green-emulator-initial','tsdoc-probe','tsdoc-repaired-probe','initial-full-emulator'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
initial=json.loads(read('initial-source-before.json'));correction=json.loads(read('fixture-correction.json'))
assert initial.keys()==source.keys() and [path for path in initial if initial[path]!=source[path]]==[correction['path']]
assert initial[correction['path']]==correction['before'] and source[correction['path']]==correction['after']
assert re.search(r'Tests:\s+2 failed, 410 passed, 412 total',read('initial-live-integrations.log'))
assert 'parseRunRecord) is not a function' in read('initial-live-integrations.log')
assert '26100 declarations are documented across 1170 files' in read('tsdoc-after-fixture.log')
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
ui=e/'native-ui'
ui_summary=json.loads((ui/'verification-summary.json').read_text())
assert ui_summary['status']=='passed' and ui_summary['totalCases']==32 and ui_summary['totalAssertions']==736 and ui_summary['documentErrorAuditSnapshots']==160
ui_manifest=ui/ui_summary['preservedEvidence']['sha256Manifest']
assert sha(ui_manifest)==ui_summary['preservedEvidence']['sha256']
ui_files=json.loads(ui_manifest.read_text());assert len(ui_files)==462
for path,expected in ui_files.items():assert (ui/path).is_relative_to(ui) and sha(ui/path)==expected,path
assert all(j['exitCode']==0 for j in ui_summary['terminalJobs'] if j.get('name','').startswith('final-'))
for path,expected in ui_summary['sourceHashes'].items():assert sha(r/path)==expected,path
assert ui_summary['cleanup']['ownedScratchRemoved'] and ui_summary['cleanup']['ownedServersStopped']
summary={'goal':'active','change':'One coherent bounded Unicode text policy covers authored answers, normalized recorded/live guesses, all five public cell fields, canonical history and optional local draft recovery.','reproduction':before,'matchingRedCoreCases':19,'matchingRedSdkCases':11,'newCoreCases':23,'newSdkCases':11,'newDraftCases':3,'fixtureCorrection':correction,'normalizedBudgetUnits':384,'authoredBudgetUnits':128,'normalizationBoundSource':'https://www.unicode.org/reports/tr15/#Detecting_Normalization_Forms','controls':'Full Indic conjuncts, canonical expansion, original evaluations/archive bytes, preloaded hints, idempotent hints/guess receipts, live hints/history, 259-unit canonical stored history, full native drafts after disposal and overbudget separate-cell normalization rejection. Oversized input still short-circuits normalization.','policyChanges':'Guesses may carry up to384 raw and normalized units; authored answers remain128 raw units. Cells must represent one grapheme. Two prior oversized guess negatives were moved to the new385-unit boundary while the original129-unit answer rejection remains. Historical storage widens from256 to384 without adding current-policy constraints to old run records.','coreTests':374,'coreSuites':38,'backendUnitTests':1669,'backendUnitSuites':134,'emulatorTests':412,'emulatorSuites':28,'pinnedNode22SdkTests':11,'portalFocusedTests':121,'portalFocusedSuites':7,'builtBrowserTests':8,'builtBrowserSuites':3,'nativeBrowser':ui_summary,'types':['core','backend','portal'],'downstreamBackendLint':'passed','tsdocDeclarations':26100,'tsdocFiles':1170,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2377,'preservedBuildFiles':1300,'compiledCoreHashes':24,'ownedParentJobsTerminal':31,'resolvedPreflights':sorted(resolved),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n');print(json.dumps({key:value for key,value in summary.items() if key!='nativeBrowser'},indent=2,ensure_ascii=False))
