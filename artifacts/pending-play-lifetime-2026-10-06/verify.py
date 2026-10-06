from pathlib import Path
import difflib,hashlib,json,re,subprocess
r=Path.cwd();e=r/'artifacts/pending-play-lifetime-2026-10-06';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda n:json.loads((e/n).read_text())
expected=read('source-before.json');baseline=read('source-baseline.json')
assert len(expected)==2450 and len(baseline)==2449
assert expected==read('source-after-builds.json')==read('source-runtime-terminal.json')==read('source-terminal.json')
assert baseline==json.loads((r/'artifacts/pending-play-scope-retirement-2026-10-06/source-before.json').read_text())
assert all(sha(r/p)==h for p,h in expected.items())
owned=read('owned-files.json');assert len(owned)==4;patch=[]
for row in owned:
 before=(r/row['before']).read_bytes() if row['before'] else b'';after=(r/row['after']).read_bytes()
 assert sha(r/row['after'])==row['afterSha256']==sha(r/row['path'])
 if row['before']:assert sha(r/row['before'])==row['beforeSha256']==baseline[row['path']]
 else:assert row['path'] not in baseline
 patch.extend(difflib.unified_diff(before.decode().splitlines(keepends=True),after.decode().splitlines(keepends=True),fromfile='a/'+row['path'] if row['before'] else '/dev/null',tofile='b/'+row['path']))
assert ''.join(patch)==(e/'owned.diff').read_text()
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
assert {p for p in baseline if baseline[p]!=expected[p]}=={row['path'] for row in owned if row['before']}
assert set(expected)-set(baseline)=={row['path'] for row in owned if not row['before']}
jobs=read('owned-jobs.json');assert len(jobs)==16 and all(x['status']=='terminal' and isinstance(x['exitCode'],int) for x in jobs)
assert all((e/log).is_file() for x in jobs for log in x['logs'])
for name in ['all-six-builds','portal-units','static-final','chromium-matrix','firefox-matrix','built-browser','facebook-built-browser','maintained-preflight','expanded-corrected','tsdoc-corrected']:assert next(x for x in jobs if x['name']==name)['exitCode']==0
for name in ['baseline-development','baseline-production','paid-guard-development','lifetime-development','expanded-preflight','units-types-tsdoc-preflight']:assert next(x for x in jobs if x['name']==name)['exitCode']==1
assert '2898 passed, 2991 total' in (e/'portal-units.log').read_text()
assert '15 skipped, 301 passed, 301 of 316 total' in (e/'portal-units.log').read_text()
assert '22 passed, 22 total' in (e/'built-browser.log').read_text()
assert '1 passed, 1 total' in (e/'facebook-browser.log').read_text()
assert '26579 declarations' in (e/'tsdoc-final.log').read_text()
assert '1265 source files' in (e/'sizes-final.log').read_text()
assert 'Web Target boundary audit passed' in (e/'boundaries-final.log').read_text()
assert 'Security configuration audit passed' in (e/'security-final.log').read_text()
assert 'error TS' not in (e/'types-final.log').read_text()
cases=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  for prefix,nc,na in [('',112,862),('scope-',84,804),('early-',30,159)]:
   name=prefix+engine+'-'+mode;obs=read(name+'/observations.json');assert len(obs)==na and all(x['actual']==x['expected'] for x in obs)
   assert len({(x['width'],x['height'],x['scenario']) for x in obs})==nc
   assert len(list((e/name).glob('*.png')))==nc
   log=read(name+'.log');assert log['cases']==nc and log['checks']==na and log['failures']==[] and log['browserVersion'].startswith('153.')
   cases+=nc;checks+=na
for mode,failures in [('development',50),('production',46)]:
 obs=read('baseline-'+mode+'/observations.json');assert len(obs)==431 and sum(x.get('actual')!=x.get('expected') for x in obs)==failures
 assert any(x['name']=='old action remains durable in original scope' and x.get('actual')!=x['expected'] for x in obs)
 assert any(x['name']=='retired callback cannot acquire a lease' and x.get('actual')!=x['expected'] for x in obs)
for mode in ['development','production']:
 obs=read('red-'+mode+'/observations.json');assert len(obs)==10 and sum(x.get('actual')!=x.get('expected') for x in obs)==3
mcp=read('firefox-mcp.json');assert mcp['isError'] and mcp['nativeFirefoxFallback']
for p,h in read('supplemental-harness-sha256.json').items():assert sha(r/p)==h
proof=read('unchanged-authority-proof.json');assert proof['allSelectedAuthorityInputsUnchanged'] and len(proof['inputs'])==824
assert all(expected[p]==baseline[p]==h==sha(r/p) for p,h in proof['inputs'].items())
for row in read('reused-authority-evidence.json'):assert sha(r/row['path'])==row['sha256']
for name,tests,suites in [('core-units.log',391,39),('backend-units.log',1730,138),('live-integrations.log',677,38),('node22-sdk.log',17,1)]:
 text=(r/'artifacts/live-same-account-retirement-2026-10-06'/name).read_text();assert re.search(r'Tests:\s+'+str(tests)+r' passed, '+str(tests)+r' total',text);assert re.search(r'Test Suites:\s+'+str(suites)+r' passed, '+str(suites)+r' total',text)
copies=json.loads((r/'artifacts/live-same-account-retirement-2026-10-06/core-copy-proof.json').read_text());assert len(copies)==24
assert all(sha(r/x['canonical'])==sha(r/x['copy'])==x['sha256'] for x in copies)
manifest=read('built-sha256.json');assert len(manifest)==1301 and {str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()}==manifest
metadata=read('target-dependencies.json');assert len(metadata)==6
for row in metadata:
 assert sha(r/row['preserved'])==row['sha256'] and not (r/row['original']).exists();data=json.loads((r/row['preserved']).read_text());assert data['target']==row['target']
 assert ('packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts' in data['modules'])==(row['target'] in ['jest','facebook','reddit'])
 assert not any('__tests__' in p or 'verify-pending-play-lifetime-browser' in p for p in data['modules'])
 if row['target']!='facebook':assert not any('FacebookRewardedContinue' in p or 'FacebookAds' in p for p in data['modules'])
 if row['target'] in ['reddit','youtube','netflix','yahoo']:assert not any('firebase' in p.lower() for p in data['modules'])
 if row['target'] in ['youtube','netflix','yahoo']:
  assert not any('/LiveRaceGame' in p for p in data['modules'])
  assert not any(any(provider in p.lower() for provider in ['firebase','sentry','fbinstant','devvit']) for p in data['packages'])
extras=read('extra-facebook-metadata.json');assert len(extras)==1
for row in extras:assert sha(r/row['preserved'])==row['sha256'] and not (r/row['original']).exists() and not Path(row['outputDirectory']).exists()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds.log').read_text()
assert 'Devvit server build passed' in (e/'builds.log').read_text()
assert not Path((e/'build-root.txt').read_text().strip()).exists()
cleanup=read('cleanup.json');assert cleanup['temporaryBuildRemoved'] and cleanup['builtBytesVerifiedBeforeCleanup']==1301 and cleanup['ownedTargetMetadataPreservedAndRemoved']==6 and cleanup['extraFacebookMetadataPreservedAndRemoved']==1 and cleanup['ownedBrowserJobsTerminal'] and cleanup['ownedBrowserScratchRemoved']
assert all(not list((r/'packages/portal/node_modules/.cache').glob(p+'*')) for p in ['pending-life-probe-','pending-play-lifetime-','pending-scope-retirement-','early-skip-check-'])
summary=dict(sourceInputs=len(expected),ownedSourceRecords=4,terminalTrackedJobs=len(jobs),portalUnitTests=2898,portalSkippedTests=93,newLifetimeCases=448,newLifetimeAssertions=3448,priorScopeCases=336,priorScopeAssertions=3216,earlySkipCases=120,earlySkipAssertions=636,totalMountedCases=cases,totalMountedAssertions=checks,builtBrowserTests=23,isolatedTargetInventories=6,preservedBuiltFiles=1301,unchangedAuthorityInputs=824,authorityEvidenceReused=True,cleanupVerified=True,goalComplete=False)
assert cases==904 and checks==7300
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
