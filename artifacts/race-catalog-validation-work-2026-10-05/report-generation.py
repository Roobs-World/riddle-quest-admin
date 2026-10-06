from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-catalog-validation-work-2026-10-05';old=r/'artifacts/race-entry-compatibility-2026-10-05'
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 t=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',t),name;assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',t),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2386 and source==json.loads(read('source-report.json'))==json.loads(read('source-terminal.json'))
previous=json.loads((old/'source-report.json').read_text())
assert set(source)-set(previous)=={'firebase-functions/src/__tests__/race/racePoolValidationWork.test.ts','firebase-functions/src/__tests__/race/racePoolValidationWork.it.test.ts'}
assert {p for p in previous if source[p]!=previous[p]}=={'firebase-functions/src/race/raceContentValidation.ts'}
assert re.search(r'Tests:\s+4 failed, 13 passed, 17 total',read('red-final.log'))
assert re.search(r'Tests:\s+4 failed, 4 total',read('red-sdk.log'))
for name,tests,suites in [('green-units.log',17,1),('green-sdk.log',4,1),('backend-units.log',1722,137),('live-integrations.log',641,34),('node22-sdk.log',21,2)]:counts(name,tests,suites)
for name in ['green-emulator.log','backend-emulator.log']:assert 'Script exited successfully (code 0)' in read(name) and 'Stopping Firestore Emulator' in read(name),name
assert '[Pinned Functions runtime v'+(r/'firebase-functions/.nvmrc').read_text().strip()+'] catalog validation work compatibility' in read('node22-sdk.log')
assert read('types-corrected.log')==read('backend-lint.log')==''
assert '26368 declarations are documented across 1179 files' in read('tsdoc-corrected.log')
assert 'Prepared deploy build artifact' in read('prepare-fixed.log')
core=json.loads(read('core-copies.json'));assert len(core)==24
for path,s in core.items():assert sha(r/path)==s,path
for name in ['minimum','fullwidth','combining','joined-emoji']:
 a=json.loads(read('baseline-final/'+name+'.json'));b=json.loads(read('fixed/'+name+'.json'));assert a['answerNormalizationCalls']==2 and b['answerNormalizationCalls']==0 and a['result']==b['result']
 assert len(a['samples'])==len(b['samples'])==20 and max(a['segmentationInputUnits'])<=128
 a=json.loads(read('baseline-sdk/'+name+'.json'));b=json.loads(read('fixed-sdk/'+name+'.json'));assert a['answerNormalizationCalls']==8 and b['answerNormalizationCalls']==0
 assert a['before']==a['after'] and b['before']==b['after']
benchmark=json.loads(read('paired-benchmark.json'));assert benchmark['runtime']=='v'+(r/'firebase-functions/.nvmrc').read_text().strip()
assert benchmark['cases']==6 and benchmark['blocks']==24 and benchmark['measuredValidations']==480 and benchmark['warmupsExcluded']==120 and benchmark['resultUnchanged']
assert benchmark['order']==['baseline','fixed','fixed','baseline'] and len(benchmark['rows'])==24
assert all(len(row['samples'])==20 for row in benchmark['rows'])
for path,s in benchmark['sourceInputs'].items():assert sha(r/path)==s,path
assert benchmark['sourceImplementations']['baseline']==sha(e/'validation-before.ts') and benchmark['sourceImplementations']['fixed']==sha(e/'validation-after.ts')
targets=['jest','facebook','reddit','youtube','netflix','yahoo'];assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
for target in targets:assert 'artifact audit passed' in read('build-'+target+'.log').lower(),target
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
oldBuilt=json.loads((old/'built-sha256.json').read_text());tested={p:s for p,s in built.items() if p.split('/')[0] in ['jest','reddit']}
assert len(tested)==832 and tested=={p:s for p,s in oldBuilt.items() if p.split('/')[0] in ['jest','reddit']}
reuse=json.loads(read('reused-evidence.json'));assert reuse['coreTests']==374 and reuse['portalTests']==127 and reuse['builtBrowserTests']==8 and reuse['freshBrowserTestedBuiltFilesIdentical']==832
for name,tests,suites in [('core.log',374,38),('portal.log',127,9),('built-browser.log',8,3)]:
 t=(old/name).read_text();assert re.search(rf'Tests:\s+{tests} passed, {tests} total',t) and re.search(rf'Test Suites:\s+{suites} passed, {suites} total',t),name
for name in ['core-types.log','portal-types.log']:assert (old/name).read_text()==''
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
cleanup=json.loads(read('cleanup.json'));assert cleanup=={'temporaryBuildRemoved':True,'ownedTargetMetadataPreservedAndRemoved':6,'ownedEmulatorsStopped':True,'builtBytesVerifiedBeforeCleanup':1300}
assert not Path(read('build-root.txt').strip()).exists()
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==19 and all(j['status']=='terminal' and j['exitCode'] is not None for j in jobs)
resolved={j['name'] for j in jobs if j['exitCode']!=j['expectedExitCode']};assert resolved=={'tsdoc-probe','built-byte-comparison-preflight','encrypted-pack-diff-inspection'}
assert all(j.get('resolution') for j in jobs if j['name'] in resolved)
assert all(j['exitCode']==j['expectedExitCode']==0 for j in jobs if j['name'].startswith('final-') or j['name']=='paired-benchmark')
owned=json.loads(read('owned-files.json'));assert len(owned)==3
for label,path in owned.items():assert (e/(label+'-after.ts')).read_bytes()==(r/path).read_bytes(),path
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
evidence={str(p.relative_to(e)):sha(p) for name in ['baseline','baseline-instrumented','baseline-final','fixed','baseline-sdk','fixed-sdk'] for p in sorted((e/name).glob('*.json'))}
evidence['paired-benchmark.json']=sha(e/'paired-benchmark.json');evidence['comparison.json']=sha(e/'comparison.json');(e/'diagnostics-sha256.json').write_text(json.dumps(evidence,indent=2)+'\n')
summary={'goal':'active','change':'Gate fresh-catalog duplicate-answer and clue-leak Unicode work on the existing raw-answer text budget while preserving all bounded-answer and independent pool diagnostics.','newUnitCases':17,'baselineUnitFailures':4,'newSdkCases':4,'baselineSdkFailures':4,'baselineAnswerNormalizationCallsPerValidation':2,'fixedAnswerNormalizationCallsPerValidation':0,'baselineAnswerNormalizationCallsAcrossFourGamePaths':8,'fixedAnswerNormalizationCallsAcrossFourGamePaths':0,'backendUnitTests':1722,'backendUnitSuites':137,'emulatorTests':641,'emulatorSuites':34,'pinnedNode22Cases':21,'pinnedNode22Suites':2,'backendTypes':'passed','backendLint':'passed','tsdocDeclarations':26368,'tsdocFiles':1179,'sixBuilds':'passed','youtube':'fixture','reusedUnchangedCoreClientBrowserEvidence':reuse,'pairedBenchmarkCases':6,'pairedMeasuredValidations':480,'pairedWarmupsExcluded':120,'pairedComparison':benchmark['comparison'],'pairedScope':benchmark['scope'],'stableSourceInputs':2386,'compiledCoreHashes':24,'preservedBuildFiles':1300,'ownedParentJobsTerminal':19,'resolvedPreflights':sorted(resolved),'cleanup':cleanup,'limits':'Pure validation timings exclude Firestore/network and production concurrency. No broad network latency gain or provider/release certification is claimed. Oversized raw answers skip Unicode duplicate/leak diagnostics; bounded slot-oversized answers and independent metadata/clue/canonical/translation/balance checks retain existing semantics.'}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
