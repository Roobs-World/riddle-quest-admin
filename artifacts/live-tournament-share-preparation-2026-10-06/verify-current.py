from pathlib import Path
import json,hashlib,runpy,sys
r=Path.cwd();e=r/'artifacts/live-tournament-share-preparation-2026-10-06'
sys.argv=['current-source-manifest.py','source-current-verified'];runpy.run_path(str(e/'current-source-manifest.py'))
cases=checks=0
for name in ['chromium-development','chromium-production','firefox-development','firefox-production','lookup-development','lookup-production','share-development','share-production']:
 rows=json.loads((e/name/'observations.json').read_text());assert all(x['actual']==x['expected'] for x in rows),name
 cases+=len({(x['width'],x['height'],x['scenario']) for x in rows});checks+=len(rows)
 assert len(list((e/name).glob('*.png')))==len({(x['width'],x['height'],x['scenario']) for x in rows})
red=json.loads((e/'current-baseline-development/observations.json').read_text());assert sum(x['actual']!=x['expected'] for x in red)==15
assert '2983 passed' in (e/'portal-units-final.log').read_text()
assert '36 passed' in (e/'adapter-oct08.log').read_text()
assert '22 passed' in (e/'built-browser.log').read_text()
assert '1 passed' in (e/'facebook-browser.log').read_text()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (e/'builds.log').read_text()
files=json.loads((e/'built-sha256.json').read_text())
for name,sha in files.items():assert hashlib.sha256((e/'built'/name).read_bytes()).hexdigest()==sha
cleanup=json.loads((e/'cleanup-current.json').read_text());assert not Path(cleanup['removedBuildRoot']).exists()
for row in cleanup['metadata']:assert not (r/row['original']).exists();assert hashlib.sha256((r/row['preserved']).read_bytes()).hexdigest()==row['sha256']
summary={'sourceInputs':2475,'browserCases':cases,'browserAssertions':checks,'portalTests':2983,'builtBrowserTests':23,'preservedBuiltFiles':len(files),'reusedAuthorityEvidence':False,'goalComplete':False}
(e/'verification-current-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
