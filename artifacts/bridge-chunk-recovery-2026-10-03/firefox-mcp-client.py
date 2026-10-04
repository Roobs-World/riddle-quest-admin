import json,os,subprocess,tempfile,shutil
from pathlib import Path
out=Path(__file__).resolve().parent
profile=tempfile.mkdtemp(prefix='bridge-firefox-verification-',dir='/home/craig-beswetherick/snap/firefox/common/mcp-tmp')
env=os.environ.copy()
for key in ['DISPLAY','WAYLAND_DISPLAY','XAUTHORITY']: env.pop(key,None)
env['TMPDIR']='/home/craig-beswetherick/snap/firefox/common/mcp-tmp'
command=['/home/craig-beswetherick/.nvm/versions/node/v24.17.0/bin/node','/home/craig-beswetherick/.npm/_npx/185dfa20d98efc9c/node_modules/@mozilla/firefox-devtools-mcp/dist/index.js','--headless','--firefox-path','/snap/firefox/current/usr/lib/firefox/firefox','--profile-path',profile,'--output-file',str(out/'firefox-verification.log')]
log=(out/'firefox-mcp-client.log').open('w')
process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,env=env)
sequence=0
records=[]
def call(method,params):
 global sequence
 sequence+=1
 message={'jsonrpc':'2.0','id':sequence,'method':method,'params':params}
 process.stdin.write(json.dumps(message)+'\n');process.stdin.flush()
 while True:
  line=process.stdout.readline()
  if not line: raise RuntimeError('MCP server closed')
  row=json.loads(line)
  if row.get('id')==sequence:
   records.append({'request':message,'response':row})
   (out/'firefox-mcp-records.json').write_text(json.dumps(records,indent=2))
   return row
try:
 call('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'bridge-firefox-verification','version':'1.0'}})
 process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');process.stdin.flush()
 print('MCP client ready',flush=True)
 for line in __import__('sys').stdin:
  request=json.loads(line)
  if request.get('name')=='_shutdown':
   print(json.dumps(call('tools/call',{'name':'close_firefox_session','arguments':{}})),flush=True)
   break
  print(json.dumps(call('tools/call',request)),flush=True)
finally:
 process.terminate()
 try: process.wait(timeout=10)
 except subprocess.TimeoutExpired: process.kill();process.wait()
 shutil.rmtree(profile,ignore_errors=True)
 log.close()
