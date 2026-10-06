from pathlib import Path
import json,subprocess,sys,time
name,log,*command=sys.argv[1:];e=Path(__file__).resolve().parent;p=e/'jobs'/f'{name}.json'
r={'name':name,'command':command,'logs':[log],'status':'running','startedAt':time.time()};p.write_text(json.dumps(r,indent=2)+'\n')
with (e/log).open('w') as output:
 result=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT)
r.update(status='terminal',exitCode=result.returncode,finishedAt=time.time());p.write_text(json.dumps(r,indent=2)+'\n');print(name,result.returncode,flush=True);sys.exit(result.returncode)
