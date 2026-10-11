from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();e=r/'artifacts/backend-current-sdk-2026-10-08';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-verified'],check=True)
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
current=json.loads((e/'source-terminal.json').read_text());old=json.loads((e/'source-sdk-terminal.json').read_text());newPath='firebase-functions/src/__tests__/singlePlayerHintLocale.it.test.ts'
assert len(current)==2502 and len(old)==2501
assert {p for p in old.keys()|current.keys() if old.get(p)!=current.get(p)}=={newPath}
assert json.loads((e/'source-before-sdk.json').read_text())==old
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==1 and owned[0]['before'] is None
assert sha(r/newPath)==owned[0]['afterSha256']==sha(e/'owned-after'/newPath)==sha(e/'singlePlayerHintLocale.it.test.ts')
prior=json.loads((r/'artifacts/solo-hint-intent-recovery-2026-10-08/source-terminal.json').read_text());assert len(prior)==2500 and all(current.get(p)==h for p,h in prior.items())
full=json.loads((e/'integration-results.json').read_text());assert full['success'] and not full['wasInterrupted'] and full['numPassedTestSuites']==87 and full['numPassedTests']==1252 and full['numPendingTests']==0
selection=set(json.loads((e/'integration-selection.json').read_text()));assert {str(Path(row['name']).relative_to(r)) for row in full['testResults']}==selection
assert {str(p.relative_to(r)) for p in (r/'firebase-functions/src/__tests__').rglob('*.it.test.ts')}==selection|{newPath}
before=json.loads((e/'focused/baseline-results.json').read_text());after=json.loads((e/'focused/current-results.json').read_text())
assert before['numFailedTests']==2 and before['numPassedTests']==2 and before['numRuntimeErrorTestSuites']==0
failed=[a for row in before['testResults'] for a in row['assertionResults'] if a['status']=='failed']
assert len(failed)==2 and any('tr/izmir' in a['title'] for a in failed) and any('historical receipt' in a['title'] for a in failed)
assert all('İ' in ''.join(a['failureMessages']) and 'I' in ''.join(a['failureMessages']) for a in failed)
assert after['success'] and after['numPassedTests']==4 and after['numPendingTests']==0 and len(after['testResults'])==1
assert str(Path(after['testResults'][0]['name']).relative_to(r))==newPath
assert json.loads((e/'focused/terminal.json').read_text())==[{'name':'baseline','exit':1,'expected':1},{'name':'current','exit':0,'expected':0}]
source=(r/'firebase-functions/src/gameplay/singlePlayerSession.ts').read_text();needle='revealedLetter: answerLetters[index].toLocaleUpperCase(state.locale),';assert source.count(needle)==1
assert (e/'focused/singlePlayerSession.before.ts').read_text()==source.replace(needle,'revealedLetter: answerLetters[index].toUpperCase(),')
applied=json.loads((e/'focused/override-applied.json').read_text());assert applied['beforeSha256']==sha(e/'focused/singlePlayerSession.before.ts') and applied['currentSha256']==sha(r/'firebase-functions/src/gameplay/singlePlayerSession.ts') and applied['beforeSha256']!=applied['currentSha256']
assert '1759 passed' in (e/'units-node22.log').read_text()
assert '[Pinned v22.23.1] @typescript/native' in (e/'runtime-static.log').read_text() and '[Pinned v22.23.1] eslint' in (e/'runtime-static.log').read_text()
assert '[Pinned Functions runtime v22.23.1]' in (e/'integrations.log').read_text() and '[Pinned Functions runtime v22.23.1]' in (e/'focused/integrations.log').read_text()
assert 'TSDoc audit passed' in (e/'tsdoc.log').read_text() and 'Maintainable-file size audit passed' in (e/'file-sizes.log').read_text()
rows=json.loads((e/'core-copy-proof.json').read_text());assert len(rows)==390
for row in rows:assert sha(r/row['canonical'])==row['sha256']==sha(r/row['copy'])
canonical={str(p.relative_to(r)) for p in (r/'packages/core/dist').rglob('*') if p.is_file()}|{'packages/core/package.json'};assert canonical=={row['canonical'] for row in rows}
assert not any(json.loads((e/'core-copy-extras.json').read_text()).values())
compiled=json.loads((e/'compiled-inputs.json').read_text());assert len(compiled)==396
for name,h in compiled.items():assert sha(e/'compiled-functions'/name)==h
assert sha(e/'compiled-functions/scripts/presence-visibility-reconcile.js')==sha(r/'firebase-functions/scripts/presence-visibility-reconcile.js')
for name,h in json.loads((e/'assessment-programs.json').read_text()).items():assert sha(e/name)==h
clean=json.loads((e/'cleanup.json').read_text());assert clean['allPortsClosed'] and len(clean['ports'])==30 and not any(row['open'] for row in clean['ports']) and not Path(clean['compiledRoot']).exists()
summary=dict(sourceInputs=len(current),unchangedPriorClientInputs=2500,ownedNewIntegrationTests=1,backendUnitTests=1759,fullExistingSdkSuites=87,fullExistingSdkTests=1252,newSdkCases=4,totalSdkSuitePaths=88,totalSdkTests=1256,originalCasingSdkFailures=2,coreCopyInputs=390,compiledFiles=396,closedAllocatedPorts=30,productionSourceChanged=False,deployed=False,goalComplete=False)
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
