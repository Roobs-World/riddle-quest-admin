from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-invitation-creator-recovery-2026-10-05';old=r/'artifacts/race-catalog-validation-work-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));previous=json.loads((old/'source-report.json').read_text())
assert len(source)==2387 and source==json.loads(read('source-terminal.json'))==json.loads(read('source-report.json'))
assert all(source[p]==s for p,s in previous.items()) and set(source)-set(previous)=={'firebase-functions/src/__tests__/race/raceLiveCreatorRecovery.it.test.ts'}
for name in ['live-sdk.log','node22-sdk.log']:
 assert re.search(r'Tests:\s+4 passed, 4 total',read(name)) and re.search(r'Test Suites:\s+1 passed, 1 total',read(name))
for name in ['live-emulator.log','node22-emulator.log']:
 assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name)
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] live creator recovery audit' in read('node22-sdk.log')
assert read('types-final.log')==read('lint-final.log')==''
assert '26380 declarations are documented across 1180 files' in read('tsdoc-final.log')
assert re.search(r'Tests:\s+4 failed, 4 total',read('red-sdk.log'))
for kind in ['space','answer','clue','canonical']:
 row=json.loads(read('live-observations/'+kind+'.json'))
 assert row==dict(kind=kind,createdPhase='searching',closedPhase='cancelled',terminalReplayVersionStable=True,sourceUnchanged=True,profilesUnchanged=True,matchedSeats=0)
targets=['jest','facebook','reddit','youtube','netflix','yahoo'];assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower()
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
assert json.loads(read('cleanup.json'))==dict(temporaryBuildRemoved=True,ownedTargetMetadataPreservedAndRemoved=6,ownedEmulatorsStopped=True,builtBytesVerifiedBeforeCleanup=1300)
assert not Path(read('build-root.txt').strip()).exists()
for label,path in json.loads(read('owned-files.json')).items():assert (r/path).read_bytes()==(e/(label+'-after.ts')).read_bytes()
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==14 and all(j['status']=='terminal' and j['exitCode'] is not None for j in jobs)
assert all(j['exitCode']==j['expectedExitCode'] or j.get('resolution') for j in jobs)
assert not (r/'firebase-functions/src/__tests__/race/raceInvitationCreatorRecovery.it.test.ts').exists()
subprocess.run(['git','diff','--check'],check=True)
summary=dict(goal='active',productionChanges=0,newLiveSdkCases=4,pinnedNode22Cases=4,legacyDiagnosticFailures=4,legacyFindingFixed=False,liveOwnerCleanup='verified',backendTypes='passed',backendLint='passed',tsdocDeclarations=26380,tsdocFiles=1180,sixBuilds='passed',youtube='fixture',sourceInputs=2387,previousSourceInputsUnchanged=2386,reusedEvidence=json.loads(read('reused-evidence.json')),builtFiles=1300,terminalJobs=14,cleanup=json.loads(read('cleanup.json')),browserObservation=False,nextCandidate='Transient failure of retired live-seat cleanup after late join')
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
