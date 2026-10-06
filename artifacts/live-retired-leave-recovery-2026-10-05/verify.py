from pathlib import Path
import difflib,hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/live-retired-leave-recovery-2026-10-05';old=r/'artifacts/race-invitation-creator-recovery-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 t=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',t),name;assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',t),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));previous=json.loads((old/'source-before.json').read_text())
assert len(source)==2390 and source==json.loads(read('source-terminal.json'))==json.loads(read('source-report.json'))
assert {p for p in previous if source[p]!=previous[p]}=={'packages/portal/src/play/race/LiveRaceGame.tsx','packages/portal/package.json'}
assert set(source)-set(previous)=={'packages/portal/src/play/race/logic/liveRaceRetirement.ts','packages/portal/src/play/race/__tests__/liveRaceRetirement.test.ts','packages/portal/scripts/verify-live-retired-leave-recovery-browser.mjs'}
assert sha(e/'game-before.tsx')==previous['packages/portal/src/play/race/LiveRaceGame.tsx'] and sha(e/'package-before.json')==previous['packages/portal/package.json']
counts('units-final.log',59,3);counts('built-browser.log',8,3)
assert read('types-final.log')=='' and '26419 declarations are documented across 1182 files' in read('tsdoc-final.log')
assert json.loads(read('red-final/observations.json'))
for name,failures in [('red-final',2),('red-close',1)]:
 rows=json.loads(read(name+'/observations.json'));assert sum(x['actual']!=x['expected'] for x in rows)==failures
nativeCases=nativeChecks=0
for browser in ['chromium','firefox']:
 for mode in ['development','production']:
  name='final-'+browser+'-'+mode;rows=json.loads(read(name+'/observations.json'))
  assert len(rows)==750 and all(x['actual']==x['expected'] for x in rows),name
  assert len({(x['width'],x['height'],x['scenario']) for x in rows})==42
  assert len(list((e/name).glob('*.png')))==42
  assert '"failures": []' in read(name+'.log')
  nativeCases+=42;nativeChecks+=len(rows)
assert read('browser-matrix.log').splitlines()==['chromium development passed','chromium production passed','firefox development passed','firefox production passed']
assert 'Mozilla Firefox 153.0' in read('firefox-version.log')
rows=json.loads(read('confirmation/observations.json'));assert len(rows)==369 and all(x['actual']==x['expected'] for x in rows)
assert len({(x['width'],x['height'],x['scenario']) for x in rows})==27
assert 'PASS 6 owned leave confirmation/retry cases' in read('active-close-final.log')
targets=['jest','facebook','reddit','youtube','netflix','yahoo'];assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
cleanup=dict(temporaryBuildRemoved=True,ownedTargetMetadataPreservedAndRemoved=6,ownedEmulatorsStopped=True,builtBytesVerifiedBeforeCleanup=1300)
assert json.loads(read('cleanup.json'))==cleanup and not Path(read('build-root.txt').strip()).exists()
assert json.loads(read('first-pass/cleanup.json'))==cleanup and not Path(read('first-pass/build-root.txt').strip()).exists()
assert json.loads(read('first-pass/source-before.json'))==json.loads(read('source-first-terminal.json'))
for label,path in json.loads(read('owned-files.json')).items():assert (r/path).read_bytes()==(e/(label+'-after.txt')).read_bytes()
patch=''
for label,path in json.loads(read('owned-files.json')).items():
 before=read('game-before.tsx' if label=='game' else 'package-before.json') if label in ['game','package'] else ''
 patch+=''.join(difflib.unified_diff(before.splitlines(True),(r/path).read_text().splitlines(True),fromfile='a/'+path if before else '/dev/null',tofile='b/'+path))
assert read('owned.diff')==patch
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==27 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode'] for j in jobs)
core=json.loads((r/'artifacts/race-catalog-validation-work-2026-10-05/core-copies.json').read_text());assert len(core)==24
for path,s in core.items():assert sha(r/path)==s
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary=dict(goal='active',newRetirementUnitCases=19,focusedUnitCases=59,focusedUnitSuites=3,originalRetirementBrowserFailures=2,firstFixCloseOwnershipFailure=1,nativeBrowserCases=nativeCases,nativeAssertions=nativeChecks,confirmationCases=27,confirmationAssertions=369,activeCloseCases=6,builtJestRedditCases=8,builtBrowserSuites=3,firefox='153.0 native Playwright',clientTypes='passed',tsdocDeclarations=26419,tsdocFiles=1182,sixBuilds='passed',youtube='fixture',sourceInputs=2390,compiledCoreHashes=24,builtFiles=1300,terminalTrackedJobs=27,reusedEvidence=json.loads(read('reused-evidence.json')),cleanup=cleanup,retirementBudget='Initial leave plus three retries, 10s command deadlines and 1/2/4s backoffs; at most 47s local waiting for four never-settling requests.',limits='Injected transport failures are component evidence, not production outage measurements. Recovery is finite; persistent outages can exhaust it. Existing recorded invitation recovery gap remains unfixed. No network latency, production concurrency or release-certification claim.')
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
