from pathlib import Path
import hashlib,json,sys
r=Path.cwd();e=r/'artifacts/race-entry-compatibility-2026-10-05'
files=set()
for name in ['src','assets','packages/core/src','packages/core/dist','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release','firebase-functions/src','firebase-functions/scripts','firebase-functions/packages/core']:
 files.update(p for p in (r/name).rglob('*') if p.is_file())
installed_core=(r/'firebase-functions/node_modules/@qwordly/core').resolve()
files.update(p for p in (installed_core/'dist').rglob('*') if p.is_file())
files.add(installed_core/'package.json')
files.update(p for p in (r/'packages/portal').iterdir() if p.is_file() and not p.name.endswith(('.zip','.tsbuildinfo')))
files.update(r/name for name in ['package.json','pnpm-lock.yaml','packages/core/package.json','firebase-functions/package.json','firebase-functions/jest.config.js','firebase-functions/jest.env.setup.js','firebase-functions/tsconfig.json','firebase-functions/firestore.rules','firebase-functions/firestore.indexes.json','firebase-functions/database.rules.json'])
current={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
name=sys.argv[1];(e/(name+'.json')).write_text(json.dumps(current,indent=2)+'\n')
if name!='source-before':assert current==json.loads((e/'source-before.json').read_text()),'Selected source inputs changed'
print(len(current),'source inputs verified',name)
