import hashlib, json, subprocess
from pathlib import Path
root=Path('/home/craig-beswetherick/Documents/riddle-quest')
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
receipt=json.loads((root/'artifacts/development-progress'/f'multiplayer_race-provider-record-recovery-{revision}.json').read_text())
c=receipt['completion']
assert c['taskId']=='multiplayer:race-provider-record-recovery' and c['revision']==revision
assert len(c['checks'])==28 and all(x['status']=='passed' for x in c['checks'])
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
h=hashlib.sha256()
for f in sorted(x for x in files if x and not x.startswith(('.codex/','artifacts/')) and x!='docs/reports/platform-release-readiness/src/data.json'):
 h.update(f.encode()); h.update(b'\0'); p=root/f; h.update(p.read_bytes() if p.exists() else b'deleted')
assert h.hexdigest()==c['sourceDigest'], 'Verified source changed'
assert len(c['artifacts'])==7
for a in c['artifacts']:
 assert hashlib.sha256((root/a['file']).read_bytes()).hexdigest()==a['sha256'], a['target']
dashboard=(root/'docs/reports/platform-release-readiness/src/data.json').read_text()
assert c['taskId'] in dashboard, 'Dashboard completion missing'
proof={'taskId':c['taskId'],'revision':revision,'sourceDigest':c['sourceDigest'],'checks':28,'targetArtifacts':7,'dashboardUpdated':True,'jestPublicationPerformed':False,'functionsDeploymentPerformed':False}
(root/'artifacts/race-provider-record-recovery/receipt-verified.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
