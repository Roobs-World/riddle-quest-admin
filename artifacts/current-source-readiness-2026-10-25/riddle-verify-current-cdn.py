import concurrent.futures,datetime,gzip,hashlib,json,pathlib,time,urllib.request,urllib.parse
root=pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
out=root/'artifacts/current-source-readiness-2026-10-25/upload'
source=json.loads((out/'provider-candidate.json').read_text())
base=source['contentBaseUrl'];expected=json.loads((out/'artifact-files.json').read_text())
assert urllib.parse.urlsplit(base).hostname=='019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com' and base.endswith('/')
started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
def fetch(item):
 name,wanted=item;url=base+urllib.parse.quote(name,safe='/')
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept-Encoding':'identity'}),timeout=35) as r:
    body=r.read();body=gzip.decompress(body)if r.headers.get('Content-Encoding')=='gzip'else body;h=hashlib.sha256(body).hexdigest();return {'file':name,'status':r.status,'bytes':len(body),'sha256':h,'matchesTestedCanonicalArchive':h==wanted,'attempt':attempt+1}
  except Exception as error:
   if attempt==2:return {'file':name,'matchesTestedCanonicalArchive':False,'errorType':type(error).__name__}
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:rows=list(pool.map(fetch,expected.items()))
report={'startedAt':started,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-t,3),'versionId':source['versionId'],'contentBaseUrl':base,'files':rows,'expectedFiles':len(expected),'matchedFiles':sum(x['matchesTestedCanonicalArchive']for x in rows),'allProviderServedBytesMatchTestedCanonicalArchive':all(x['matchesTestedCanonicalArchive']for x in rows),'scope':'Read-only GET of static inactive-candidate files; no provider state mutation.'}
(out/'provider-content-hashes.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='files'},indent=2));raise SystemExit(0 if report['allProviderServedBytesMatchTestedCanonicalArchive'] else 1)
