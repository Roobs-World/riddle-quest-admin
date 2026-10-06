from pathlib import Path
import json,re,hashlib,subprocess,sys
r=Path.cwd();e=r/'artifacts/race-cell-glyph-fit-2026-10-05';old=r/'artifacts/race-answer-input-shape-2026-10-05'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return (e/name).read_text()
def counts(name,tests,suites):
 t=read(name);assert re.search(rf'Tests:\s+{tests} passed, {tests} total',t),name;assert re.search(rf'Test Suites:\s+{suites} passed, {suites} total',t),name
subprocess.run([sys.executable,str(e/'source-manifest.py'),'source-report'],check=True)
source=json.loads(read('source-before.json'));assert len(source)==2383 and source==json.loads(read('source-report.json'))
uncached=json.loads(read('uncached-verification/source-before.json'));assert {p for p in source if source[p]!=uncached[p]}=={'packages/portal/src/input/useGuessGlyphFit.ts'}
previous=json.loads((old/'source-report.json').read_text());assert set(source)-set(previous)=={'packages/portal/src/input/useGuessGlyphFit.ts'}
assert {p for p in previous if previous[p]!=source[p]}=={'packages/portal/src/play/GameFrameControls.tsx','packages/portal/src/styles.puzzle.css'}
prior=json.loads((old/'verification-summary.json').read_text());assert prior['backendUnitTests']==1702 and prior['emulatorTests']==531 and prior['pinnedNode22SdkCases']==77 and prior['coreTests']==374
core=json.loads(read('core-copies.json'));assert len(core)==24
for p,s in core.items():assert sha(r/p)==s
baseline=json.loads(read('baseline/terminal.json'));fixed=json.loads(read('fixed/terminal.json'))
assert baseline['cases']==160 and baseline['documentStates']==480 and baseline['overflowDocumentStates']==48 and baseline['maxHorizontalOverflowPixels']==20 and baseline['overflowControls']==['hi']
assert fixed['cases']==160 and fixed['documentStates']==500 and fixed['overflowDocumentStates']==0 and fixed['maxHorizontalOverflowPixels']==0 and fixed['selectedSourceInputs']==2383
assert baseline['sourceStable'] and baseline['portClosed'] and fixed['sourceStable'] and fixed['portClosed']
assert json.loads(read('fixed/source-before.json'))==source==json.loads(read('fixed/source-after.json'))
for phase in ['baseline','fixed']:
 rows=json.loads(read(phase+'/measurements.json'));assert len(rows)==(480 if phase=='baseline' else 500);assert len(list((e/phase).glob('*.png')))==32
 assert {x['browser'] for x in rows}=={'chromium','firefox'} and {x['mode'] for x in rows}=={'development','production'} and len({x['kind'] for x in rows})==10 and len({x['viewportName'] for x in rows})==4
counts('portal.log',127,9);counts('built-browser.log',8,3);counts('phone-layout.log',1,1)
assert read('portal-types.log')=='' and '26257 declarations are documented across 1176 files' in read('tsdoc.log')
targets=['jest','facebook','reddit','youtube','netflix','yahoo']
assert read('builds.log').splitlines()==[t+' build passed' for t in targets]
for t in targets:assert 'artifact audit passed' in read('build-'+t+'.log').lower(),t
assert 'YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1' in read('build-youtube.log') and 'audit:youtube-artifact:fixture' in read('build-youtube.log')
built={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()};assert len(built)==1300 and built==json.loads(read('built-sha256.json'))
uncachedBuilt={str(p.relative_to(e/'uncached-verification/built')):sha(p) for p in sorted((e/'uncached-verification/built').rglob('*')) if p.is_file()};assert len(uncachedBuilt)==1300 and uncachedBuilt==json.loads(read('uncached-verification/built-sha256.json'))
for row in json.loads(read('uncached-verification/target-dependencies.json')):assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
rows=json.loads(read('target-dependencies.json'));assert len(rows)==6
for row in rows:assert not (r/row['original']).exists() and sha(r/row['preserved'])==row['sha256']
cleanup=json.loads(read('cleanup.json'));assert cleanup['temporaryBuildRemoved'] and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['ownedServersStopped']
assert not Path(read('build-root.txt').strip()).exists()
jobs=json.loads(read('owned-jobs.json'));assert len(jobs)==20 and all(j['status']=='terminal' and j['exitCode']==j['expectedExitCode']==0 for j in jobs)
cost=json.loads(read('input-cost.json'));assert cost['cases']==12 and cost['measuredEdits']==1200 and cost['portClosed']
assert {row['phase'] for row in cost['rows']}=={'baseline','fixed'} and {row['kind'] for row in cost['rows']}=={'letters','nfd','hi'} and all(len(row['samples'])==100 for row in cost['rows'])
comparison=json.loads(read('input-cost-comparison.json'));timings={}
for label,d,phase in [('baseline',cost,'baseline'),('uncached',json.loads(read('uncached-verification/input-cost.json')),'fixed'),('cached',cost,'fixed')]:
 timings[label]={'caseMedianRangeMs':[min(x['medianMs'] for x in d['rows'] if x['phase']==phase),max(x['medianMs'] for x in d['rows'] if x['phase']==phase)],'maximumCaseP95Ms':max(x['p95Ms'] for x in d['rows'] if x['phase']==phase)}
assert comparison['timings']==timings
owned=json.loads(read('owned-files.json'));assert len(owned)==3
for label,name in owned.items():assert (e/(label+'-after.txt')).read_bytes()==(r/name).read_bytes()
subprocess.run(['git','apply','--check','--reverse',str(e/'owned.diff')],check=True);subprocess.run(['git','diff','--check'],check=True)
for p,s in json.loads(read('browser-evidence-sha256.json')).items():assert sha(e/p)==s,p
summary={'goal':'active','change':'Fit full displayed graphemes inside original circular answer cells with batched geometry and one board-level observer.','baselineCases':160,'baselineDocumentStates':480,'baselineOverflowStates':48,'baselineMaximumOverflowPixels':20,'fixedCases':160,'fixedDocumentStates':500,'fixedOverflowStates':0,'supportedControls':10,'browsers':['Chromium','Firefox153'],'reactModes':['development','production'],'viewports':4,'portalTests':127,'portalSuites':9,'portalTypes':'passed','tsdocDeclarations':26257,'tsdocFiles':1176,'builtBrowserTests':8,'builtBrowserSuites':3,'fullGamePhoneFitTests':1,'fullGamePhoneSizes':8,'sixBuilds':'passed','youtube':'fixture','unchangedBackendCoreEvidence':str(old.relative_to(r)),'stableSourceInputs':2383,'compiledCoreHashes':24,'preservedBuildFiles':1300,'ownedTerminalJobs':20,'inputCostCases':12,'inputCostMeasuredEdits':1200,'inputCostScope':cost['scope'],'inputCostTimingComparison':timings,'cleanup':cleanup,'limits':'No network latency, OS IME, provider certification or all pathological Unicode ink-shape guarantee. Geometry measurement covers rendered text bounds and ten supported controls.'}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
