from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();e=r/'artifacts/host-deferred-riddle-2026-10-08'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run(['python3',str(e/'source-manifest.py'),'source-terminal'],check=True)
owned=json.loads((e/'owned-files.json').read_text());assert len(owned)==7
for x in owned:
 assert sha(r/x['path'])==x['afterSha256']==sha(r/x['after'])
 if x['before']:assert sha(r/x['before'])==x['beforeSha256']
subprocess.run(['git','apply','--reverse','--check',str(e/'owned.diff')],check=True)
checks=0
names=[f'{engine}-{mode}' for engine in ['chromium','firefox'] for mode in ['development','production']]+[f'{suite}-{mode}' for suite in ['commit','coalescing','suspension','warmups'] for mode in ['development','production']]
for name in names:
 v=json.loads((e/name/'observations.json').read_text());assert v
 meaningful=[x for x in v if not x.get('diagnostic')];assert all(x['actual']==x['expected'] for x in meaningful),name;checks+=len(meaningful)
for mode in ['development','production']:
 v=json.loads((e/f'baseline-{mode}'/'observations.json').read_text());assert len([x for x in v if x['actual']!=x['expected']])==2
for name,needle in [('units-all-final.log','2991 passed'),('tsdoc.log','TSDoc audit passed'),('file-sizes.log','Maintainable-file size audit passed'),('built-browser.log','22 passed'),('facebook-browser.log','1 passed')]:assert needle in (e/name).read_text(),name
assert all(f'{target} build passed' in (e/'builds-resumed.log').read_text() for target in ['jest','facebook','reddit','youtube','netflix','yahoo','Devvit server'])
hashes=json.loads((e/'built-sha256.json').read_text());assert len(hashes)==1301
for name,hash in hashes.items():assert sha(e/'built'/name)==hash
metric=json.loads((e/'startup-bytes.json').read_text());assert metric['initialResourceBytes']<=metric['budget']
cleanup=json.loads((e/'cleanup.json').read_text());assert all(not Path(p).exists() for p in cleanup['buildRoots']);assert all(not (r/p).exists() for p in cleanup['metadata'])
assert list((e/'rendered-standards').glob('*.html'));assert list((e/'rendered-standards').glob('*.png'))
summary={'sourceInputs':2480,'ownedInputs':7,'browserAssertions':checks,'unitTests':2991,'builtBrowserTests':23,'builtFiles':len(hashes),'startupBytes':metric['initialResourceBytes'],'goalComplete':False,'reusedAuthorityEvidence':False,'remainingCandidate':'Expired local delivery still admits a deferred provider read'}
(e/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
