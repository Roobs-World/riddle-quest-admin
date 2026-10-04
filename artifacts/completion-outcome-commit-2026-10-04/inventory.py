import pathlib,hashlib,json,sys
roots=['packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal']
files=[p for root in roots for p in pathlib.Path(root).rglob('*') if p.is_file()]+[pathlib.Path(p) for p in ['packages/core/package.json','packages/portal/package.json','packages/portal/vite.config.ts']]
data={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
pathlib.Path(sys.argv[1]).write_text(json.dumps(data,indent=2)+'\n')
print('Source inputs:',len(data))
