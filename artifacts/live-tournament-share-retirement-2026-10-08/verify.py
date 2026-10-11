from pathlib import Path
import json,hashlib,runpy,sys
r=Path.cwd();e=r/'artifacts/live-tournament-share-retirement-2026-10-08'
sys.argv=['source-manifest.py','source-verified'];runpy.run_path(str(e/'source-manifest.py'))
cases=checks=0
for name in ['chromium-development','chromium-production','firefox-development','firefox-production','lookup-development','lookup-production','share-development','share-production','preparation-development','preparation-production','minimal-green-development','minimal-green-production','profile-abandon-supplement']:
 rows=json.loads((e/name/'observations.json').read_text());assert all(x['actual']==x['expected'] for x in rows),name
 cases+=len({(x['width'],x['height'],x['scenario']) for x in rows});checks+=len(rows)
 assert len(list((e/name).glob('*.png')))==len({(x['width'],x['height'],x['scenario']) for x in rows})
for name in ['minimal-baseline-development','minimal-baseline-production']:
 red=json.loads((e/name/'observations.json').read_text());assert len(red)==28 and sum(x['actual']!=x['expected'] for x in red)==7
for row in json.loads((e/'owned-files.json').read_text()):
 data=(r/row['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==row['afterSha256'];assert data==(r/row['after']).read_bytes()
for name,sha in json.loads((e/'supplemental-harness-sha256.json').read_text()).items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha
before=json.loads((r/'artifacts/live-tournament-share-preparation-2026-10-06/source-current-verified.json').read_text());after=json.loads((e/'source-before.json').read_text())
assert {x for x in before.keys()|after.keys() if before.get(x)!=after.get(x)}=={x['path'] for x in json.loads((e/'owned-files.json').read_text())}
import subprocess
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
assert '2986 passed' in (e/'portal-units.log').read_text()
assert '39 passed' in (e/'adapter-final-preflight.log').read_text()
assert '22 passed' in (e/'built-browser.log').read_text()
assert '1 passed' in (e/'facebook-browser.log').read_text()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds.log').read_text()
files=json.loads((e/'built-sha256.json').read_text())
for name,sha in files.items():assert hashlib.sha256((e/'built'/name).read_bytes()).hexdigest()==sha
cleanup=json.loads((e/'cleanup.json').read_text());assert not Path(cleanup['removedBuildRoot']).exists()
for row in cleanup['metadata']:assert not (r/row['original']).exists();assert hashlib.sha256((r/row['preserved']).read_bytes()).hexdigest()==row['sha256']
summary={'sourceInputs':2476,'browserCases':cases,'browserAssertions':checks,'portalTests':2986,'builtBrowserTests':23,'preservedBuiltFiles':len(files),'reusedAuthorityEvidence':False,'goalComplete':False}
assert cases==398 and checks==5712
assert len(list((e/'rendered-standards').glob('*.html')))==len(list((e/'rendered-standards').glob('*.png')))>0
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
