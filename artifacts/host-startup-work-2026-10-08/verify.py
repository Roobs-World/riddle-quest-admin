from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();e=r/'artifacts/host-startup-work-2026-10-08'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-terminal'],check=True)
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==5
for x in owned:
 assert sha(r/x['path'])==x['afterSha256']==sha(r/x['after'])
 if x['before']:assert sha(r/x['before'])==x['beforeSha256']
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
checks=0
names=[f'{engine}-{mode}' for engine in ['chromium','firefox'] for mode in ['development','production']]+[f'{suite}-{mode}' for suite in ['commit','coalescing','suspension','warmups'] for mode in ['development','production']]
for name in names:
 v=json.loads((e/name/'observations.json').read_text());assert v
 meaningful=[x for x in v if not x.get('diagnostic')];assert all(x['actual']==x['expected'] for x in meaningful),name;checks+=len(meaningful)
for name,needle in [('units-all.log','2992 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed')]:assert needle in (e/name).read_text(),name
assert all(f'{target} build passed' in (e/'builds.log').read_text() for target in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1299
for name,hash in hashes.items():assert sha(e/'built'/name)==hash
metric=json.loads((e/'startup-bytes.json').read_text());assert metric['initialResourceBytes']<=metric['budget']
cleanup=json.loads((e/'cleanup.json').read_text());assert all(not Path(p).exists() for p in cleanup['buildRoots']);assert all(not (r/p).exists() for p in cleanup['metadata'])
assert list((e/'rendered-standards').glob('*.html'));assert list((e/'rendered-standards').glob('*.png'))

measurements=json.loads((e/'measurements.json').read_text());assert len(measurements)==10
for row in measurements:
 assert row['initialBytes']==(576715 if row['side']=='baseline' else 566836)
 assert len(row['eagerCatalog'])==(3 if row['side']=='baseline' else 0)
 directory=e/'measurements'/f"{row['pair']}-{row['side']}"
 assert 'Jest artifact audit passed' in (directory/'audit.log').read_text()
 assert sum(x['bytes'] for x in row['resources'])==row['initialBytes']
 for resource in row['resources']:
  p=directory/resource['name'];assert p.stat().st_size==resource['bytes'];assert sha(p)==resource['sha256']
old=next(x for x in owned if x['path'].endswith('/achievements.ts'))
before=(r/old['before']).read_text();start=before.index('/** Terminal result fields');end=before.index('/**\n * @deprecated',start)
current=(r/'packages/portal/src/play/predictCompletionAchievements.ts').read_text();assert current[current.index('/** Terminal result fields'):]==before[start:end]

summary={'sourceInputs':2481,'ownedInputs':5,'browserAssertions':checks,'unitTests':2992,'builtBrowserTests':23,'builtFiles':len(hashes),'startupBytes':metric['initialResourceBytes'],'goalComplete':False,'reusedAuthorityEvidence':False,'remainingCandidate':'Measure real player-path timing and rendering/transport work'}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
