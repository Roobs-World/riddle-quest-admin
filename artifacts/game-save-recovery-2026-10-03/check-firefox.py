import json,re
from pathlib import Path
out=Path(__file__).resolve().parent;records=json.loads((out/'firefox-mcp-records.json').read_text());checks=[]
def fields(id,expected):
 row=next(r for r in records if r['request']['id']==id);s=next(b['text'] for b in row['response']['result']['content'] if b['type']=='text');v=json.loads(re.search(r'```json\s*(.*?)\s*```',s,re.S).group(1));v=json.loads(v) if isinstance(v,str) else v
 for key,want in expected.items():
  checks.append({'requestId':id,'field':key,'actual':v[key],'expected':want});assert v[key]==want,(id,key,v[key],want)
fields(5,{'draft':'PIAN','failures':['player_data_save_failed'],'draftWrites':1,'unacknowledged':True,'durable':'','errors':[],'unhandled':[]})
fields(6,{'draft':'PIAN','failures':['player_data_save_failed'],'draftWrites':2,'durable':'PIAN','nativeEdits':4,'errors':[],'unhandled':[]})
fields(11,{'draft':'PIAN','draftWrites':1,'preferenceFailures':2,'errors':[],'unhandled':[]})
fields(12,{'draft':'PIAN','draftWrites':1,'durable':'','preferences':False,'errors':[],'unhandled':[]})
fields(14,{'draft':'PIAN','durable':'PIAN','draftWrites':2,'preferences':{'highContrast':True,'reducedMotion':False},'nativeEdits':4,'errors':[],'unhandled':[]})
fields(17,{'guesses':1,'completions':1,'clear':None,'errors':[],'unhandled':[]})
fields(21,{'draft':'PIAN','preferenceFailures':2,'untouchedLocale':'fr','highContrast':False,'errors':[],'unhandled':[]})
fields(22,{'draft':'PIAN','durable':'PIAN','untouchedLocale':'fr','highContrast':True,'reducedMotion':False,'nativeEdits':4,'errors':[],'unhandled':[]})
(out/'firefox-checks.json').write_text(json.dumps(checks,indent=2));print(len(checks),'Firefox checks passed')
