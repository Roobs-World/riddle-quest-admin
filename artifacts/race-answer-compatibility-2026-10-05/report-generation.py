from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-answer-compatibility-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 text=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',text),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',text),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2362 and source==json.loads(read('source-report.json'))
counts('runtime-probe.log',2,1)
assert '{"answerKind":"padded","answerUnits":5,"trimmedGraphemes":3,"poolAccepted":true,"failure":"normal-and-padded-guess-rejected"}' in read('runtime-probe.log')
assert '{"answerKind":"oversized-encoding","answerUnits":129,"trimmedGraphemes":1,"poolAccepted":true,"failure":"evaluation-projection-rejected"}' in read('runtime-probe.log')
assert re.search(r'Tests:\s+6 failed, 18 passed, 24 total',read('red-unit.log'))
assert re.search(r'Tests:\s+10 failed, 4 passed, 14 total',read('red-emulator.log'))
counts('green-emulator.log',14,1);counts('green-focused.log',59,4)
counts('backend-units.log',1665,134);counts('live-integrations.log',381,26);counts('built-browser.log',8,3)
for name in ['green-emulator.log','emulator-run.log']:assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name)
assert read('backend-types.log')==read('backend-lint.log')==''
assert '26017 declarations are documented across 1164 files' in read('tsdoc.log')
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
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==14 and all(j['status']=='terminal' for j in jobs)
assert all(j['exitCode']==j['expectedExitCode'] for j in jobs)
for name,path in json.loads(read('owned-files.json')).items():assert (e/(name+'-after.ts')).read_bytes()==(r/path).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'Catalog readiness rejects answer padding and validates original immutable answer text against the published evaluation schema before deck or seat publication.','reproductions':[{'kind':'padded answer','units':5,'trimmedGraphemes':3,'poolAcceptedBefore':True,'failure':'Both normal and padded guesses rejected by the real engine.'},{'kind':'oversized encoding','units':129,'trimmedGraphemes':1,'poolAcceptedBefore':True,'failure':'Published evaluation rejected.'}],'matchingRedUnitCases':6,'matchingRedSdkCases':10,'newUnitCases':8,'newRealSdkCases':14,'scope':'New catalog-based category/deck/seat creation; immutable historical recordings and retained tickets are a separate candidate. No content rewriting or single-player policy expansion.','controls':'Legal decomposed and uppercase answers retain original deck text; public/private invalid joins publish no records; duplicate correct guesses advance once; canonical balances and unaffected categories remain unchanged.','singlePlayerAudit':'ASCII policy confirmed intentional in authored transliteration, playable-answer guards and request schemas.','backendUnitTests':1665,'backendUnitSuites':134,'emulatorTests':381,'emulatorSuites':26,'focusedTests':59,'focusedSuites':4,'builtBrowserTests':8,'builtBrowserSuites':3,'bufferedTransitionBudgetMs':100,'types':'passed','targetedLint':'passed','tsdocDeclarations':26017,'tsdocFiles':1164,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2362,'preservedBuildFiles':1300,'ownedJobsTerminal':14,'cleanup':cleanup}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
