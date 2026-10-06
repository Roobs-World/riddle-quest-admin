from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-entry-compatibility-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 t=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',t),name;assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',t),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2384 and source==json.loads(read('source-report.json'))
initial=json.loads(read('initial-verification/source-before.json'))
assert set(source)==set(initial) and {p for p in source if source[p]!=initial[p]}=={'firebase-functions/src/__tests__/race/raceEntryCompatibility.it.test.ts'}
for name,tests,suites in [('green-sdk.log',90,1),('green-callables.log',105,1),('backend-units.log',1705,136),('live-integrations.log',637,33),('node22-sdk.log',90,1),('core.log',374,38),('portal.log',127,9),('built-browser.log',8,3)]:counts(name,tests,suites)
assert re.search(r'Tests:\s+46 failed, 24 passed, 70 total',read('red-corrected-sdk.log'))
assert re.search(r'Tests:\s+4 failed, 101 passed, 105 total',read('red-callables.log'))
assert re.search(r'Tests:\s+2 failed, 635 passed, 637 total',read('initial-verification/live-integrations.log'))
assert 'JestAccountDeletedError: account-deleted' in read('initial-verification/live-integrations.log')
assert 'Script exited successfully (code 0)' in read('backend-emulator.log') and 'Stopping Firestore Emulator' in read('backend-emulator.log')
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] recorded entry SDK compatibility' in read('node22-sdk.log')
for name in ['core-types.log','backend-types.log','portal-types.log','backend-lint.log']:assert read(name)=='',name
assert '26337 declarations are documented across 1177 files' in read('tsdoc.log')
assert 'Prepared deploy build artifact' in read('prepare-fixed.log')
core=json.loads(read('core-copies.json'));assert len(core)==24
for path,s in core.items():assert sha(r/path)==s,path
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True,'builtBytesVerifiedBeforeCleanup':1300}
assert not Path(read('build-root.txt').strip()).exists()
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==28 and all(j['status']=='terminal' and j['exitCode'] is not None for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode'] or j.get('childDiagnosticsPresent')}
assert resolved=={'module-generation-preflight','types-and-callables-initial','green-sdk-initial','tsdoc-probe','ledger-serialization-preflight','initial-backend'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==j['expectedExitCode']==0 for j in jobs if j['name'].startswith('final-'))
red=json.loads(read('red-observations-corrected-analysis.json'));green=json.loads(read('green-observations-analysis.json'))
assert red['observations']==32 and red['changedObservations']==22 and len(red['changedPaths'])==1
assert green['observations']==60 and green['changedObservations']==0 and not green['changedPaths']
observations=json.loads(read('observations-sha256.json'));assert len(observations)==92
for p,s in observations.items():assert sha(e/p)==s,p
owned=json.loads(read('owned-files.json'));assert len(owned)==7
for label,path in owned.items():assert (e/(label+'-after.ts')).read_bytes()==(r/path).read_bytes(),path
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
summary={'goal':'active','change':'Validate original frozen race content before recorded readiness or recipient binding; share user-aware admission with the legacy preview callable and preserve accepted recovery.','newSdkCases':90,'baselineSdkFailures':46,'baselineTypedStructuralFailures':4,'baselineCapturedSeatMutations':22,'greenCapturedSeatMutations':0,'newCallableCases':3,'baselineCallableFailures':4,'backendUnitTests':1705,'backendUnitSuites':136,'emulatorTests':637,'emulatorSuites':33,'originalInvitationLifecycleCases':16,'pinnedNode22SdkCases':90,'coreTests':374,'coreSuites':38,'portalFocusedTests':127,'portalFocusedSuites':9,'builtBrowserTests':8,'builtBrowserSuites':3,'types':['core','backend','portal'],'backendLint':'passed','tsdocDeclarations':26337,'tsdocFiles':1177,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2384,'compiledCoreHashes':24,'preservedBuildFiles':1300,'ownedParentJobsTerminal':len(jobs),'resolvedPreflights':sorted(resolved),'productionStableAcrossCorrectedFixture':True,'legacyPreviewTransactionCount':1,'cleanup':cleanup,'limits':'No measured network latency gain, production deployment, provider certification, or YouTube release certification. Four initial modern oversized-clue cases were already parser errors and are now typed invalid entry. The final fixture-only rerun preserves all other verified source hashes.'}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
