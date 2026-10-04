import json,shutil
from pathlib import Path
out=Path(__file__).resolve().parent
records=json.loads((out/'firefox-mcp-records.json').read_text())
def result(n):
 r=next(r for r in records if r['response'].get('id')==n)
 s=r['response']['result']['content'][0]['text'].split('```json\n')[1].split('\n```')[0]
 return json.loads(json.loads(s))
checks=[];observations=[]
for n in [35,39,48]:
 for row in result(n):
  observations.append(row)
  expected={'direction':'rtl','allControlsFit':True,'errors':[],'unhandled':[],'draft':'PIAN','notice':1}
  for field,want in expected.items():
   if field in row:
    checks.append({'case':row['case'],'field':field,'actual':row[field],'expected':want})
    assert row[field]==want,(row['case'],field,row[field],want)
  if 'keyHeight' in row:
   checks.append({'case':row['case'],'field':'keyHeight>=32','actual':row['keyHeight']>=32,'expected':True})
   assert row['keyHeight']>=32
for n,name in [(34,'firefox-ar-solo-500x494.png'),(40,'firefox-ar-unsaved-500x494.png'),(49,'firefox-ar-race-844x390.png')]:
 r=next(r for r in records if r['response'].get('id')==n)
 source=r['response']['result']['content'][0]['text'].split('Screenshot saved to: ')[1].split(' (')[0]
 shutil.copyfile(source,out/name)
(out/'firefox-observations.json').write_text(json.dumps(observations,indent=2))
(out/'firefox-assertions.json').write_text(json.dumps(checks,indent=2))
print(len(checks),'Firefox assertions passed')
