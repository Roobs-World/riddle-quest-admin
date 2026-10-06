from pathlib import Path
import difflib,hashlib,json,re,subprocess
r=Path.cwd();e=r/'artifacts/live-history-provider-2026-10-06';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda n:json.loads((e/n).read_text())
expected=read('source-before.json');baseline=read('source-baseline.json');assert len(expected)==2451 and len(baseline)==2450
assert expected==read('source-after-builds.json')==read('source-runtime-terminal.json')==read('source-terminal.json')
assert baseline==json.loads((r/'artifacts/pending-play-lifetime-2026-10-06/source-before.json').read_text()) and all(sha(r/p)==h for p,h in expected.items())
owned=read('owned-files.json');assert len(owned)==3;patch=[]
for row in owned:
 before=(r/row['before']).read_bytes() if row['before'] else b'';after=(r/row['after']).read_bytes();assert sha(r/row['after'])==row['afterSha256']==sha(r/row['path'])
 if row['before']:assert sha(r/row['before'])==row['beforeSha256']==baseline[row['path']]
 else:assert row['path'] not in baseline
 patch.extend(difflib.unified_diff(before.decode().splitlines(keepends=True),after.decode().splitlines(keepends=True),fromfile='a/'+row['path'] if row['before'] else '/dev/null',tofile='b/'+row['path']))
assert ''.join(patch)==(e/'owned.diff').read_text();subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
assert {p for p in baseline if baseline[p]!=expected[p]}=={x['path'] for x in owned if x['before']} and set(expected)-set(baseline)=={x['path'] for x in owned if not x['before']}
jobs=read('owned-jobs.json');assert len(jobs)==20 and all(x['status']=='terminal' and isinstance(x['exitCode'],int) for x in jobs);assert all((e/log).is_file() for x in jobs for log in x['logs'])
for name in ['all-six-builds','portal-units','static-final','chromium-matrix','firefox-matrix','built-browser','facebook-built-browser','expanded-preflight','types-tsdoc-preflight','minimal-green-development','minimal-final-green-development','minimal-final-green-production']:assert next(x for x in jobs if x['name']==name)['exitCode']==0
for name in ['fixture-intercepted-development','fixture-intercepted-production','minimal-red-development','minimal-red-production','baseline-development','baseline-production','minimal-final-baseline-development','minimal-final-baseline-production']:assert next(x for x in jobs if x['name']==name)['exitCode']==1
assert '2898 passed, 2991 total' in (e/'portal-units.log').read_text() and '15 skipped, 301 passed, 301 of 316 total' in (e/'portal-units.log').read_text()
assert '22 passed, 22 total' in (e/'built-browser.log').read_text() and '1 passed, 1 total' in (e/'facebook-browser.log').read_text()
assert '26583 declarations' in (e/'tsdoc-final.log').read_text() and '1265 source files' in (e/'sizes-final.log').read_text()
assert 'Web Target boundary audit passed' in (e/'boundaries-final.log').read_text() and 'Security configuration audit passed' in (e/'security-final.log').read_text() and 'error TS' not in (e/'types-final.log').read_text()
cases=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  name=engine+'-'+mode;obs=read(name+'/observations.json');assert len(obs)==285 and all(x['actual']==x['expected'] for x in obs)
  assert len({(x['width'],x['height'],x['scenario']) for x in obs})==24 and len(list((e/name).glob('*.png')))==24
  log=read(name+'.log');assert log['cases']==24 and log['checks']==285 and log['failures']==[] and log['browserVersion'].startswith('153.');cases+=24;checks+=285
for mode in ['development','production']:
 for name in ['red-'+mode,'minimal-final-baseline-'+mode]:
  obs=read(name+'/observations.json');assert len(obs)==12 and sum(x.get('actual')!=x.get('expected') for x in obs)==2
  assert {x['name'] for x in obs if x.get('actual')!=x.get('expected')}=={'only current-provider rows exist during commit','replacement cannot start a rematch from an old history ticket'}
 name='minimal-final-green-'+mode;obs=read(name+'/observations.json');assert len(obs)==12 and all(x['actual']==x['expected'] for x in obs)
 partial=read('baseline-'+mode+'/observations.json');assert len(partial)==7 and all(x['scenario']=='provider' for x in partial);assert sum(x.get('actual')!=x.get('expected') for x in partial)==(3 if mode=='development' else 2)
 assert 'locator.waitFor: Timeout 30000ms exceeded' in (e/('baseline-'+mode+'.log')).read_text()
 if mode=='development':assert next(x['actual'] for x in partial if x['name']=='one admitted history read per mounted effect lifetime')==2
for p,h in read('supplemental-harness-sha256.json').items():assert sha(r/p)==h
proof=read('unchanged-authority-proof.json');assert proof['allSelectedAuthorityInputsUnchanged'] and len(proof['inputs'])==824 and all(expected[p]==baseline[p]==h==sha(r/p) for p,h in proof['inputs'].items())
for row in read('reused-authority-evidence.json'):assert sha(r/row['path'])==row['sha256']
for name,tests,suites in [('core-units.log',391,39),('backend-units.log',1730,138),('live-integrations.log',677,38),('node22-sdk.log',17,1)]:
 text=(r/'artifacts/live-same-account-retirement-2026-10-06'/name).read_text();assert re.search(r'Tests:\s+'+str(tests)+r' passed, '+str(tests)+r' total',text) and re.search(r'Test Suites:\s+'+str(suites)+r' passed, '+str(suites)+r' total',text)
copies=json.loads((r/'artifacts/live-same-account-retirement-2026-10-06/core-copy-proof.json').read_text());assert len(copies)==24 and all(sha(r/x['canonical'])==sha(r/x['copy'])==x['sha256'] for x in copies)
manifest=read('built-sha256.json');assert len(manifest)==1301 and {str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()}==manifest
metadata=read('target-dependencies.json');assert len(metadata)==6
for row in metadata:
 assert sha(r/row['preserved'])==row['sha256'] and not (r/row['original']).exists();data=json.loads((r/row['preserved']).read_text());assert data['target']==row['target']
 assert ('packages/portal/src/play/race/components/LiveRaceHistory.tsx' in data['modules'])==(row['target'] in ['facebook','reddit'])
 assert not any('__tests__' in p or 'verify-live-history-provider-browser' in p for p in data['modules'])
 if row['target']!='facebook':assert not any('FacebookRewardedContinue' in p or 'FacebookAds' in p for p in data['modules'])
 if row['target'] in ['reddit','youtube','netflix','yahoo']:assert not any('firebase' in p.lower() for p in data['modules'])
 if row['target'] in ['youtube','netflix','yahoo']:
  assert not any('/LiveRaceGame' in p for p in data['modules'])
  assert not any(any(provider in p.lower() for provider in ['firebase','sentry','fbinstant','devvit']) for p in data['packages'])
extras=read('extra-facebook-metadata.json');assert len(extras)==1
for row in extras:assert sha(r/row['preserved'])==row['sha256'] and not (r/row['original']).exists() and not Path(row['outputDirectory']).exists()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds.log').read_text()
assert 'Devvit server build passed' in (e/'builds.log').read_text() and not Path((e/'build-root.txt').read_text().strip()).exists()
cleanup=read('cleanup.json');assert cleanup['temporaryBuildRemoved'] and cleanup['builtBytesVerifiedBeforeCleanup']==1301 and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['extraFacebookMetadataPreservedAndRemoved']==1 and cleanup['ownedBrowserJobsTerminal'] and cleanup['ownedBrowserScratchRemoved']
assert all(not list((r/'packages/portal/node_modules/.cache').glob(p+'*')) for p in ['live-history-provider-probe-','live-history-provider-'])
summary=dict(sourceInputs=len(expected),ownedSourceRecords=3,terminalTrackedJobs=len(jobs),portalUnitTests=2898,portalSkippedTests=93,mountedHistoryCases=cases,mountedHistoryAssertions=checks,minimalGreenCases=4,minimalGreenAssertions=24,builtBrowserTests=23,isolatedTargetInventories=6,preservedBuiltFiles=1301,unchangedAuthorityInputs=824,authorityEvidenceReused=True,cleanupVerified=True,goalComplete=False)
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
