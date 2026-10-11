from pathlib import Path
import hashlib,json,shutil,re
r=Path.cwd();e=Path(__file__).resolve().parent;build=Path('/tmp/live-draft-writer-builds-20261009a')
assert '22 passed' in (e/'built-browser.log').read_text() and '1 passed' in (e/'facebook-browser.log').read_text()
fbnames=set(re.findall(r'/tmp/riddle-quest-facebook-browser-[A-Za-z0-9]+',(e/'facebook-browser.log').read_text()));assert len(fbnames)==1
fb=Path(next(iter(fbnames)));assert build.is_dir() and not fb.exists()
hashes={}
for p in sorted(build.rglob('*')):
 if p.is_file():
  dest=e/'built'/p.relative_to(build);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);hashes[str(dest.relative_to(e/'built'))]=hashlib.sha256(dest.read_bytes()).hexdigest()
assert len(hashes)==1299,len(hashes)
(e/'built-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
metadata=[]
for p in (r/'artifacts/target-dependencies/custom').glob('*/*.json'):
 data=json.loads(p.read_text());directory=data.get('outputDirectory','')
 if directory.startswith(str(build)+'/') or directory==str(fb):
  dest=e/'build-metadata'/p.parent.name/p.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);metadata.append(str(p.relative_to(r)))
assert len(metadata)==7,metadata
for name in metadata:
 p=r/name;p.unlink();p.parent.rmdir()
shutil.rmtree(build)
(e/'cleanup.json').write_text(json.dumps({'metadata':metadata,'buildRoots':[str(build),str(fb)],'facebookFixtureRemovedByHarness':True,'allAbsent':all(not (r/p).exists() for p in metadata) and not build.exists() and not fb.exists()},indent=2)+'\n')
print('Archived 1299 built files and seven inventories; owned build roots absent.')
