from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-answer-input-shape-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 value=read(name)
 assert re.search(rf'Tests:\s+{tests} passed, {tests} total',value),name
 assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',value),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
assert len(json.loads(read('source-report.json')))==2382
for name,failed,passed,total in [('red-units.log',18,10,28),('red-sdk.log',24,33,57),('red-recording.log',18,2,20)]:assert re.search(rf'Tests:\s+{failed} failed, {passed} passed, {total} total',read(name)),name
for name,tests,suites in [('green-units.log',28,1),('green-sdk.log',77,2),('backend-units.log',1702,136),('live-integrations.log',531,31),('node22-sdk.log',77,2),('core.log',374,38),('portal.log',121,7),('built-browser.log',8,3)]:counts(name,tests,suites)
assert 'Script exited successfully (code 0)' in read('backend-emulator.log') and 'Stopping Firestore Emulator' in read('backend-emulator.log')
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] answer input shape SDK compatibility' in read('node22-sdk.log')
for name in ['core-types.log','backend-types.log','portal-types.log','backend-lint.log']:assert read(name)=='',name
assert '26235 declarations are documented across 1175 files' in read('tsdoc.log')
assert 'Prepared deploy build artifact' in read('prepare-fixed.log')
core=json.loads(read('core-copies.json'));assert len(core)==24
for path,s in core.items():assert sha(r/path)==s,path
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True,'ownedNativeServerStopped':True}
assert not Path(read('build-root.txt').strip()).exists()
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==19 and all(j['status']=='terminal' for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode'] or j.get('childExitCode',0)!=j.get('expectedChildExitCode',0)};assert resolved=={'recording-setup-preflight','tsdoc-declaration-preflight'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==0 for j in jobs if j['name'].startswith('final-'))
owned=json.loads(read('owned-files.json'));assert len(owned)==5
for label,path in owned.items():assert (e/(label+'-after.ts')).read_bytes()==(r/path).read_bytes(),path
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
u=e/'native-ui';ui=json.loads((u/'verification-summary.json').read_text());assert ui['cases']==80 and ui['checks']==1984 and ui['screenshots']==80 and ui['auditSnapshots']==400 and ui['portClosed'] and ui['sourceStable']
a=json.loads((u/'source-before.json').read_text());assert len(a)==13 and a==json.loads((u/'source-after.json').read_text())
for path,s in a.items():assert sha(r/path)==s
for path,s in json.loads((u/'evidence-sha256.json').read_text()).items():assert sha(u/path)==s,path
summary={'goal':'active','change':'Reject whitespace-only answer slots at fresh catalog and new frozen-deck admission, matching actual native editor behavior; preserve supported graphemes and accepted recovery.','newUnitCases':28,'matchingRedUnitFailures':18,'newSdkCases':77,'matchingRedSdkFailures':42,'backendUnitTests':1702,'backendUnitSuites':136,'emulatorTests':531,'emulatorSuites':31,'pinnedNode22SdkCases':77,'coreTests':374,'coreSuites':38,'portalFocusedTests':121,'portalFocusedSuites':7,'builtBrowserTests':8,'builtBrowserSuites':3,'nativeUi':ui,'types':['core','backend','portal'],'backendLint':'passed','tsdocDeclarations':26235,'tsdocFiles':1175,'sixBuilds':'passed','youtube':'fixture','stableSourceInputs':2382,'compiledCoreHashes':24,'preservedBuildFiles':1300,'ownedParentJobsTerminal':19,'resolvedPreflights':sorted(resolved),'cleanup':cleanup,'limits':'No measured network latency improvement, release certification, OS composition or system clipboard claim. Long conjunct glyph sizing remains a separate follow-up.'}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
