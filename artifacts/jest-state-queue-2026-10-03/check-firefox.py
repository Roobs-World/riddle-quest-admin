import json,re
from pathlib import Path
out=Path(__file__).resolve().parent
records=json.loads((out/'firefox-mcp-records.json').read_text());checks=[]
def result(id):
 row=next(r for r in records if r['request']['id']==id)
 blocks=row['response']['result']['content'];s=next(b['text'] for b in blocks if b['type']=='text');value=json.loads(re.search(r'```json\s*(.*?)\s*```',s,re.S).group(1))
 return json.loads(value) if isinstance(value,str) else value
def check(id,name,actual,expected):
 checks.append({'requestId':id,'name':name,'actual':actual,'expected':expected});assert actual==expected,(id,name,actual,expected)
def fields(id,expected):
 value=result(id)
 for key,want in expected.items():check(id,key,value[key],want)
 return value
v=fields(5,{'draft':'PIAN','writes':1,'acks':[False],'errors':[],'unhandled':[]});check(5,'SDK initialized',v['initializations']>0,True)
fields(14,{'draft':'PIAN','checkpoint':'PIAN','coins':80,'writes':1,'edits':12,'failures':[]})
fields(26,{'draft':'PIAN','letters':'PIAN','coins':80,'writes':1,'acks':[False],'errors':[],'unhandled':[]})
v=fields(27,{'draft':'PIAN','epoch':'1','errors':[],'unhandled':[]});check(27,'two SDK snapshots',len(v['writes']),2);check(27,'retained draft',v['writes'][-1]['letters'],'PIAN');check(27,'fresh profile',v['writes'][-1]['coins'],80);check(27,'acknowledged only after release',all(x['ack'] for x in v['writes']),True)
fields(31,{'guesses':1,'completions':1,'clear':None,'failures':[],'errors':[],'unhandled':[]})
fields(34,{'oldAnswer':'PIAN','playerId':'other-player','coins':80,'importedAnswer':'','writes':1,'acks':[False]})
v=fields(35,{'draft':'','playerId':'other-player','coins':80,'storedCoins':80,'failures':[],'errors':[],'unhandled':[]});check(35,'two distinct player snapshots',[x['playerId'] for x in v['writes']],['jest-player','other-player']);check(35,'no retired answer imported',v['writes'][-1]['letters'],'');check(35,'SDK acknowledgements drained',all(x['ack'] for x in v['writes']),True)
v=fields(43,{'draft':'PIAN','coins':80,'letters':'PIAN','failures':[],'errors':[],'unhandled':[]});check(43,'header image assets render',all(x['complete'] and x['width']>0 for x in v['images']),True)
(out/'firefox-checks.json').write_text(json.dumps(checks,indent=2));print(len(checks),'Firefox checks passed')
