import concurrent.futures,datetime,gzip,hashlib,json,pathlib,time,urllib.request,urllib.parse
root=pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
out=root/'artifacts/current-source-readiness-2026-10-25/upload'
source=json.loads((root/'docs/evidence/completion-readback-2026-10-25.json').read_text())
assert source['versionId']=='01a17226-db08-708f-86a1-6733b1fe4824'
base=urllib.parse.urljoin(source['contentUrl'], './');expected={x['path']:x['sha256']for x in source['files']}
assert urllib.parse.urlsplit(base).hostname=='019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com' and base.endswith('/')
started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
def fetch(item):
 name,wanted=item;url=base+urllib.parse.quote(name,safe='/')
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept-Encoding':'identity'}),timeout=35) as r:
    body=r.read();body=gzip.decompress(body)if r.headers.get('Content-Encoding')=='gzip'else body;h=hashlib.sha256(body).hexdigest();return {'file':name,'status':r.status,'bytes':len(body),'sha256':h,'matchesHeldManualBuild':h==wanted,'attempt':attempt+1}
  except Exception as error:
   if attempt==2:return {'file':name,'matchesHeldManualBuild':False,'errorType':type(error).__name__}
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:rows=list(pool.map(fetch,expected.items()))
report={'startedAt':started,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-t,3),'versionId':source['versionId'],'contentBaseUrl':base,'files':rows,'expectedFiles':len(expected),'matchedFiles':sum(x['matchesHeldManualBuild']for x in rows),'allProviderServedBytesMatchHeldManualBuild':all(x['matchesHeldManualBuild']for x in rows),'scope':'Read-only GET of static held manual-active files; no provider state mutation.'}
(out/'manual-provider-content-after.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='files'},indent=2));raise SystemExit(0 if report['allProviderServedBytesMatchHeldManualBuild'] else 1)
