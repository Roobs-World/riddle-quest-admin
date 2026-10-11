from pathlib import Path
import json,hashlib,runpy,sys,subprocess
r=Path.cwd();e=r/'artifacts/host-retired-warmups-2026-10-08'
sys.argv=['source-manifest.py','source-verified'];runpy.run_path(str(e/'source-manifest.py'))
cases=checks=0
for name in ['chromium-development','chromium-production','firefox-development','firefox-production','commit-development','commit-production','coalescing-development','coalescing-production','suspension-development','suspension-production','minimal-green-development','minimal-green-production']:
 rows=json.loads((e/name/'observations.json').read_text());assert all(x['actual']==x['expected'] for x in rows if not x.get('diagnostic')),name
 count=len({(x['width'],x['height'],x['scenario']) for x in rows});cases+=count;checks+=len([x for x in rows if not x.get('diagnostic')])
 if not name.startswith('coalescing'):assert len(list((e/name).glob('*.png')))==count
for name in ['minimal-baseline-development','minimal-baseline-production']:
 rows=json.loads((e/name/'observations.json').read_text());assert len(rows)==16 and sum(x['actual']!=x['expected'] for x in rows)==2
owned=json.loads((e/'owned-files.json').read_text())
for row in owned:
 data=(r/row['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==row['afterSha256'];assert data==(r/row['after']).read_bytes()
 if row['before']:assert hashlib.sha256((r/row['before']).read_bytes()).hexdigest()==row['beforeSha256']
before=json.loads((r/'artifacts/host-recovery-suspension-2026-10-08/source-verified.json').read_text());after=json.loads((e/'source-before.json').read_text())
assert {x for x in before.keys()|after.keys() if before.get(x)!=after.get(x)}=={x['path'] for x in owned}
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
assert '2989 passed' in (e/'portal-units.log').read_text()
assert '33 passed' in (e/'units-green.log').read_text()
assert '2 failed, 22 passed' in (e/'units-red.log').read_text()
assert '22 passed' in (e/'built-browser.log').read_text()
assert '1 passed' in (e/'facebook-browser.log').read_text()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds.log').read_text()
assert 'Devvit server build passed' in (e/'builds.log').read_text()
for name,marker in [('tsdoc-final.log','TSDoc audit passed'),('sizes-final.log','size audit passed'),('security-final.log','Security configuration audit passed')]:assert marker in (e/name).read_text()
files=json.loads((e/'built-sha256.json').read_text())
for name,sha in files.items():assert hashlib.sha256((e/'built'/name).read_bytes()).hexdigest()==sha
cleanup=json.loads((e/'cleanup.json').read_text());assert not Path(cleanup['removedBuildRoot']).exists();assert all(not Path(x).exists() for x in cleanup['facebookFixtureRoots'])
for row in cleanup['metadata']:assert not (r/row['original']).exists();assert hashlib.sha256((r/row['preserved']).read_bytes()).hexdigest()==row['sha256']
assert cases==164 and checks==1484
assert len(list((e/'rendered-standards').glob('*.html')))==len(list((e/'rendered-standards').glob('*.png')))>0
summary={'sourceInputs':len(after),'browserCases':cases,'browserAssertions':checks,'portalTests':2989,'builtBrowserTests':23,'preservedBuiltFiles':len(files),'reusedAuthorityEvidence':False,'goalComplete':False}
(e/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
