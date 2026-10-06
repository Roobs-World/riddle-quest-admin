from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-unicode-answers-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2361 and source==json.loads(read('source-report.json'))
counts('runtime-probe.log',1,1)
assert '{"locale":"fr","answerUnits":9,"answerGraphemes":7,"poolAccepted":true,"legacyProjection":"accepted","evaluationProjection":"rejected","guessRequest":"rejected","engineGuess":"correct"}' in read('runtime-probe.log')
assert re.search(r'Tests:\s+5 failed, 8 passed, 13 total',read('red-core.log'))
assert re.search(r'Tests:\s+8 failed, 2 passed, 10 total',read('red-emulator.log'))
counts('node22-emulator.log',10,1);counts('green-emulator.log',10,1);counts('core-units-probe.log',338,36);counts('core-units.log',338,36)
counts('backend-units.log',1657,134);counts('live-integrations.log',367,25);counts('built-browser.log',8,3);counts('portal-focused.log',59,6)
for name in ['green-emulator.log','emulator-run.log','node22-emulator.log']:assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name)
for name in ['backend-types.log','portal-types.log','core-types-probe.log','backend-lint.log']:assert read(name)=='',name
assert '25997 declarations are documented across 1163 files' in read('tsdoc.log')
assert 'Prepared deploy build artifact' in read('core-sync.log')
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] Unicode SDK compatibility' in read('node22-emulator.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==22 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']};assert resolved=={'tsdoc-probe','tsdoc-repaired-probe'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'Current/preloaded evaluation answers and recorded-race guess requests use the game\'s seven-grapheme limit within the existing live transport\'s 128-unit string bound.','reproduction':{'locale':'fr','answer':'élément in NFD','units':9,'graphemes':7,'poolAcceptedBefore':True,'engineGuessBefore':'correct','evaluationResponseBefore':'rejected','guessContractBefore':'rejected','redCoreCases':5,'redSdkCases':8},'newCoreCases':13,'newSdkCases':10,'pinnedNode22SdkCases':10,'localesExercised':['fr','ru','ja','hi'],'controls':'Retained original evaluation/private answer bytes, normalized scoring, hints, answer-free responses, single accepted guess on replay, account balances, eight-slot rejection, bounded raw input and trim semantics. Existing response-acceptance SDK controls included.','coreTests':338,'coreSuites':36,'backendUnitTests':1657,'backendUnitSuites':134,'emulatorTests':367,'emulatorSuites':25,'portalFocusedTests':59,'portalFocusedSuites':6,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':['core','backend','portal'],'targetedLint':'passed','tsdocDeclarations':25997,'tsdocFiles':1163,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2361,'preservedBuildFiles':1300,'ownedJobsTerminal':22,'resolvedDocumentationPreflights':sorted(resolved),'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n');print(json.dumps(summary,indent=2,ensure_ascii=False))
