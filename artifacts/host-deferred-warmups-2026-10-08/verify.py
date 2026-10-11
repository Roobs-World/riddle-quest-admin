from pathlib import Path
import json,hashlib,runpy,sys,subprocess
r=Path.cwd();e=r/'artifacts/host-deferred-warmups-2026-10-08'
sys.argv=['source-manifest.py','source-verified'];runpy.run_path(str(e/'source-manifest.py'))
cases=checks=0
for name in ['chromium-development','chromium-production','firefox-development','firefox-production','commit-development','commit-production','coalescing-development','coalescing-production','suspension-development','suspension-production','warmups-development','warmups-production','ownership-supplement','admitted-failure-green']:
 rows=json.loads((e/name/'observations.json').read_text());assert all(x['actual']==x['expected'] for x in rows if not x.get('diagnostic')),name
 count=len({(x['width'],x['height'],x['scenario']) for x in rows});cases+=count;checks+=len([x for x in rows if not x.get('diagnostic')])
 if not name.startswith('coalescing'):assert len(list((e/name).glob('*.png')))==count
for name in ['baseline-development','baseline-production']:
 rows=json.loads((e/name/'observations.json').read_text());assert len(rows)==15 and sum(x['actual']!=x['expected'] for x in rows)==2
owned=json.loads((e/'owned-files.json').read_text())
for row in owned:
 data=(r/row['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==row['afterSha256'];assert data==(r/row['after']).read_bytes()
 if row['before']:assert hashlib.sha256((r/row['before']).read_bytes()).hexdigest()==row['beforeSha256']
before=json.loads((r/'artifacts/host-retired-warmups-2026-10-08/source-verified.json').read_text());after=json.loads((e/'source-before.json').read_text())
assert {x for x in before.keys()|after.keys() if before.get(x)!=after.get(x)}=={x['path'] for x in owned}
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
assert '2991 passed' in (e/'portal-units-final.log').read_text()
assert '35 passed' in (e/'units-budget-final-preflight.log').read_text()

assert '22 passed' in (e/'built-browser.log').read_text()
assert '1 passed' in (e/'facebook-browser.log').read_text()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds-final.log').read_text()
assert 'Devvit server build passed' in (e/'builds-final.log').read_text()
for name,marker in [('tsdoc-final.log','TSDoc audit passed'),('sizes-final.log','size audit passed'),('security-final.log','Security configuration audit passed')]:assert marker in (e/name).read_text()
files=json.loads((e/'built-sha256.json').read_text())
for name,sha in files.items():assert hashlib.sha256((e/'built'/name).read_bytes()).hexdigest()==sha
cleanup=json.loads((e/'cleanup.json').read_text());assert all(not Path(x).exists() for x in cleanup['removedBuildRoots']);assert all(not Path(x).exists() for x in cleanup['facebookFixtureRoots'])
for row in cleanup['metadata']:assert not (r/row['original']).exists();assert hashlib.sha256((r/row['preserved']).read_bytes()).hexdigest()==row['sha256']
assert cases==180 and checks==1557
assert len(list((e/'rendered-standards').glob('*.html')))==len(list((e/'rendered-standards').glob('*.png')))>0
for name,sha in json.loads((e/'supplemental-harness-sha256.json').read_text()).items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha
red=json.loads((e/'admitted-failure-red/observations.json').read_text());assert sum(x['actual']!=x['expected'] for x in red)==1
import re
root=e/'built/jest';refs=set(re.findall(r'(?:src|href)=["\']([^"\']+)',(root/'index.html').read_text()));total=sum((root/x.split('?')[0]).stat().st_size for x in refs if not x.startswith(('http','data:','#')))
measurement=json.loads((e/'startup-byte-measurement.json').read_text());assert total==measurement['after']<measurement['budget'];assert measurement['before']-total==measurement['saved']==161
summary={'sourceInputs' :len(after),'browserCases':cases,'browserAssertions':checks,'portalTests':2991,'builtBrowserTests':23,'preservedBuiltFiles':len(files),'reusedAuthorityEvidence':False,'goalComplete':False}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
