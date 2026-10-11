from pathlib import Path
import hashlib,json,re,subprocess
r=Path.cwd();e=r/'artifacts/backend-reliability-2026-10-08'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-terminal'],check=True)
previous=json.loads((r/'artifacts/host-startup-work-2026-10-08/source-terminal.json').read_text());current=json.loads((e/'source-terminal.json').read_text());assert all(current.get(k)==v for k,v in previous.items())
for row in json.loads((e/'core-copy-proof.json').read_text()):assert sha(r/row['canonical'])==row['sha256']==sha(r/row['copy'])
assert len(json.loads((e/'core-copy-proof.json').read_text()))==390
assert not any(json.loads((e/'core-copy-extras.json').read_text()).values())
initial=json.loads((e/'integration-results.json').read_text());assert initial['numTotalTestSuites']==87 and initial['numFailedTests']==1 and initial['numPassedTests']==1251
failed=[x for x in initial['testResults'] if x['status']!='passed'];assert len(failed)==1 and failed[0]['name'].endswith('presenceVisibilityReconciliation.it.test.ts')
probe=json.loads((e/'project-scope-probe.json').read_text());assert probe[0]['error']=='invalid-scope' and probe[0]['length']==31 and probe[1]['accepted'] and probe[1]['length']==23
focus=json.loads((e/'focused/integration-results.json').read_text());assert focus['numFailedTests']==0 and focus['numPassedTests']==1
resumed=json.loads((e/'resumed/integration-results.json').read_text());assert resumed['success'] and resumed['numTotalTestSuites']==57 and resumed['numPassedTestSuites']==57 and resumed['numFailedTests']==0 and resumed['numPendingTests']==0
selection=json.loads((e/'resume-selection.json').read_text());assert len(selection['completed'])==30 and len(selection['remaining'])==57
completed=set(re.findall(r'^PASS (\S+\.it\.test\.ts)',(e/'corrected/integrations.log').read_text(),re.M));assert completed==set(selection['completed']);assert not re.search(r'^FAIL ',(e/'corrected/integrations.log').read_text(),re.M)
actual={str(Path(x['name']).relative_to(r/'firebase-functions')) for x in resumed['testResults']};assert actual==set(selection['remaining'])
all_paths={str(p.relative_to(r/'firebase-functions')) for p in (r/'firebase-functions/src/__tests__').rglob('*.it.test.ts')};assert completed|actual==all_paths and len(all_paths)==87
assert all(x['status']=='passed' for x in resumed['testResults'])
for name in ['corrected/integrations.log','focused/integrations.log','resumed/integrations.log']:assert '[Pinned Functions runtime v22.23.1]' in (e/name).read_text()
for name,needle in [('units-node22.log','1758 passed'),('core-tests.log','391 passed'),('runtime-static.log','[Pinned v22.23.1] eslint'),('scalability-audit.log','Backend scalability audit passed'),('module-cycles.log','Production module cycle audit passed')]:assert needle in (e/name).read_text()
compiled=json.loads((e/'compiled-inputs.json').read_text());assert len(compiled)==395
for name,hash in compiled.items():assert sha(e/'compiled-functions'/name)==hash
assert sha(e/'compiled-functions/scripts/presence-visibility-reconcile.js')==sha(r/'firebase-functions/scripts/presence-visibility-reconcile.js')
cleanup=json.loads((e/'cleanup.json').read_text());assert not Path(cleanup['compiledRoot']).exists();assert all(not x['open'] for x in cleanup['ports'])
summary={'selectedSourceInputs':len(current),'coreCopyFiles':390,'coreTests':391,'backendUnitTests':1758,'integrationSuitePathsPassedAcrossCorrectedRuns':87,'resumedIntegrationTests':resumed['numPassedTests'],'initialFullSelectionTests':1252,'initialFixtureFailures':1,'interruptedCorrectedExitCode':143,'compiledInputs':len(compiled),'goalComplete':False,'productionSourceChanged':False,'deployed':False}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
