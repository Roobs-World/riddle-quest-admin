from pathlib import Path
import hashlib,json,shutil
r=Path.cwd();e=r/'artifacts/live-overlay-owner-2026-10-06';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
jobs=[json.loads(p.read_text()) for p in sorted((e/'jobs').glob('*.json'))];assert len(jobs)==17 and all(p['status']=='terminal' for p in jobs)
(e/'owned-jobs.json').write_text(json.dumps(jobs,indent=2)+'\n')
root=Path((e/'build-root.txt').read_text().strip());assert root.parent==Path('/tmp') and root.name.startswith('live-context-builds-') and root.is_dir()
assert not (e/'built').exists();shutil.copytree(root,e/'built')
built={str(p.relative_to(root)):sha(p) for p in sorted(root.rglob('*')) if p.is_file()};assert len(built)==1301 and built=={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()}
(e/'built-sha256.json').write_text(json.dumps(built,indent=2)+'\n')
(e/'target-dependencies').mkdir(exist_ok=True);metadata=[];extras=[];fb=next(x for x in jobs if x['name']=='facebook-built-browser')
for p in sorted((r/'artifacts/target-dependencies/custom').glob('*/*.json')):
 d=json.loads(p.read_text());output=d.get('outputDirectory','')
 if output==str(root/d['target']):
  dest=e/'target-dependencies'/p.name;dest.write_bytes(p.read_bytes());metadata.append(dict(target=d['target'],original=str(p.relative_to(r)),preserved=str(dest.relative_to(r)),sha256=sha(p),outputDirectory=output))
 elif d['target']=='facebook' and output.startswith('/tmp/riddle-quest-facebook-browser-') and fb['startedAt']<=p.stat().st_mtime<=fb['finishedAt']:
  assert not Path(output).exists();dest=e/'target-dependencies/facebook-browser.json';dest.write_bytes(p.read_bytes());extras.append(dict(original=str(p.relative_to(r)),preserved=str(dest.relative_to(r)),sha256=sha(p),outputDirectory=output))
assert len(metadata)==6 and {x['target'] for x in metadata}=={'jest','facebook','reddit','youtube','netflix','yahoo'} and len(extras)==1
for name,data in [('target-dependencies.json',metadata),('extra-facebook-metadata.json',extras)]: (e/name).write_text(json.dumps(data,indent=2)+'\n')
for x in metadata+extras:
 p=r/x['original'];assert sha(p)==sha(r/x['preserved'])==x['sha256'];p.unlink()
assert not list((r/'packages/portal/node_modules/.cache').glob('overlay-owner-probe-*'))
shutil.rmtree(root)
cleanup=dict(temporaryBuildRemoved=not root.exists(),builtBytesVerifiedBeforeCleanup=len(built),ownedTargetMetadataPreservedAndRemoved=len(metadata),extraFacebookMetadataPreservedAndRemoved=len(extras),ownedBrowserJobsTerminal=True,ownedBrowserScratchRemoved=True)
(e/'cleanup.json').write_text(json.dumps(cleanup,indent=2)+'\n');print(json.dumps(cleanup))
