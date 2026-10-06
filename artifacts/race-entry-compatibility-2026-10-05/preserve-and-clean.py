from pathlib import Path
import hashlib,json,shutil,socket
r=Path.cwd();e=r/'artifacts/race-entry-compatibility-2026-10-05';root=Path((e/'build-root.txt').read_text().strip())
assert root.parent==Path('/tmp') and root.name.startswith('race-entry-compatibility-builds-')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected=json.loads((e/'built-sha256.json').read_text())
assert expected=={str(p.relative_to(e/'built')):sha(p) for p in sorted((e/'built').rglob('*')) if p.is_file()}
assert expected=={str(p.relative_to(root)):sha(p) for p in sorted(root.rglob('*')) if p.is_file()}
rows=json.loads((e/'target-dependencies.json').read_text());assert len(rows)==6
for row in rows:
 original=r/row['original'];preserved=r/row['preserved']
 assert sha(original)==sha(preserved)==row['sha256']
 assert Path(json.loads(original.read_text())['outputDirectory']).parent==root
for port in [43333,51565,59561,43495,37953]:
 with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0,port
for row in rows:
 p=r/row['original'];p.unlink()
 if not list(p.parent.iterdir()):p.parent.rmdir()
shutil.rmtree(root)
result={'temporaryBuildRemoved':not root.exists(),'ownedTargetMetadataPreservedAndRemoved':len(rows),'ownedEmulatorsStopped':True,'builtBytesVerifiedBeforeCleanup':len(expected)}
(e/'cleanup.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
