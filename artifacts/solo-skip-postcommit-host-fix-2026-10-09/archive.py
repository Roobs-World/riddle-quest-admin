from pathlib import Path
import hashlib,json,shutil,sys
r=Path.cwd();e=Path(__file__).resolve().parent
if len(sys.argv)>1:e=e/sys.argv[1]
build=Path('/tmp/solo-skip-postcommit-host-fix-builds-20261009a');assert build.is_dir();hashes={}
for p in sorted(build.rglob('*')):
 if p.is_file():
  dest=e/'built'/p.relative_to(build);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);hashes[str(dest.relative_to(e/'built'))]=hashlib.sha256(dest.read_bytes()).hexdigest()
assert len(hashes)==1299,len(hashes)
(e/'built-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n');metadata=[]
for p in (r/'artifacts/target-dependencies/custom').glob('*/*.json'):
 if json.loads(p.read_text()).get('outputDirectory','').startswith(str(build)+'/'):
  dest=e/'build-metadata'/p.parent.name/p.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);metadata.append(str(p.relative_to(r)))
assert len(metadata)==6,metadata
for name in metadata:
 p=r/name;p.unlink()
 if not any(p.parent.iterdir()):p.parent.rmdir()
shutil.rmtree(build)
(e/'cleanup.json').write_text(json.dumps({'builtFiles':len(hashes),'metadataArchived':len(metadata),'ownedBuildRootRemoved':not build.exists()},indent=2)+'\n')
print('Archived',len(hashes),'outputs and',len(metadata),'inventories; owned build root removed')
