from pathlib import Path
import hashlib,json,statistics
root=Path('/home/craig-beswetherick/Documents/riddle-quest')
p=root/'artifacts/buffered-transition-parser-2026-10-05'
expected={'current-baseline':(6,4),'current-repeat':(6,4),'work-counters':(6,1),'frame-counters':(6,5),'current-traces':(3,2),'boundary-counters':(6,3),'loader-counters':(6,4),'lock-counters':(6,5),'visual-modal-pairs':(12,5)}
results={};data={}
for name,(runs,failures) in expected.items():
 rows=json.loads((p/name/'observations.json').read_text());data[name]=rows
 assert len(rows)==runs and sum(row['rafObservedMs']>=100 for row in rows)==failures,name
 assert all(row['held']==row['delivered']==1 for row in rows),name
 results[name]={'runs':len(rows),'over100ms':failures,'medianRafObservedMs':statistics.median(row['rafObservedMs'] for row in rows),'maxRafObservedMs':max(row['rafObservedMs'] for row in rows)}
 # Exact command inputs and code were captured by each probe before browser work.
 parameters=json.loads((p/name/'parameters.json').read_text());assert parameters['cpuRate']==12
 assert (p/name/'probe-source.mjs').is_file()
assert sum(item['runs'] for item in results.values())==57
for name in ['current-baseline','current-repeat']:
 assert 'Buffered transition exceeds the unchanged 100ms limit' in (p/(name+'.log')).read_text()
parser_totals=[sum(value['ms'] for value in row['work']['parsers']) for row in data['work-counters']]
store_totals=[sum(value['ms'] for value in row['work']['storage']) for row in data['work-counters']]
assert max(parser_totals)<7 and max(store_totals)<2
assert all(row['work']['geometry']==[] for row in data['frame-counters'])
lock_waits=[];load_deltas=[]
for row in data['lock-counters']:
 locks=row['work']['locks'];assert len(locks)==2 and [x['phase'] for x in locks]==['request','acquired'] and all(x['mode']=='shared' for x in locks)
 lock_waits.append(locks[1]['wait'])
 boundaries={x['label']:x['at'] for x in row['work']['boundaries']}
 load_deltas.append(boundaries['services-proxy:start']-locks[1]['at'])
 assert abs(load_deltas[-1])<1
 assert abs(boundaries['services-proxy:loaded']-boundaries['services-proxy:start'])<1
visual={}
for held in [False,True]:
 group=[row for row in data['visual-modal-pairs'] if row['heldCompletion']==held];assert len(group)==6
 visual['retained' if held else 'original']={'runs':6,'over100ms':sum(row['rafObservedMs']>=100 for row in group),'medianRafObservedMs':statistics.median(row['rafObservedMs'] for row in group),'maxRafObservedMs':max(row['rafObservedMs'] for row in group),'medianDomCommitMs':statistics.median(row['domCommitMs'] for row in group)}
assert visual['retained']['medianRafObservedMs']>visual['original']['medianRafObservedMs']
# This earlier candidate kept reducer victory active, so its only completed control is excluded.
assert 'Buffered transition waited for the server' in (p/'modal-pairs.log').read_text()
assert len(json.loads((p/'modal-pairs/observations.json').read_text()))==1
artifact=json.loads((p/'artifact-manifest.json').read_text());source=Path(artifact['root'])
actual={str(f.relative_to(source)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(source.rglob('*')) if f.is_file()}
assert actual==artifact['files'] and len(actual)==411
fingerprints=json.loads((p/'runtime-source-fingerprints.json').read_text())
roots=['src','assets','packages/core/src','packages/portal/src','packages/portal/targets','config/vite/portal','packages/portal/scripts','scripts/release']
files={f for name in roots for f in (root/name).rglob('*') if f.is_file()}
files.update(f for f in (root/'packages/portal').iterdir() if f.is_file() and not f.name.endswith(('.zip','.tsbuildinfo')))
files.update(root/f for f in ['package.json','pnpm-lock.yaml','packages/core/package.json'])
after={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(files)}
assert after==fingerprints
(p/'source-after-verification.json').write_text(json.dumps(after,indent=2)+'\n')
timelines=[]
for file in sorted((p/'current-traces').glob('trace-*.json')):
 events=json.loads(file.read_text())['traceEvents'];marks={x['name']:x for x in events if x['name'].startswith('RQ-BUFFERED-TRACE:')}
 start=marks['RQ-BUFFERED-TRACE:start'];end=marks['RQ-BUFFERED-TRACE:observed']['ts'];begin=start['ts']
 selected=[]
 for event in events:
  if event.get('tid')!=start['tid'] or event.get('pid')!=start['pid'] or event.get('ph')!='X' or event['ts']>=end or event['ts']+event.get('dur',0)<=begin:continue
  if event['name'] in ['FunctionCall','FireAnimationFrame','UpdateLayoutTree','Layout','Paint','MajorGC'] and event.get('dur',0)>500:
   selected.append({'name':event['name'],'startMs':(event['ts']-begin)/1000,'durationMs':event.get('dur',0)/1000,'data':event.get('args',{})})
 timelines.append({'trace':file.name,'windowMs':(end-begin)/1000,'events':selected,'durationsAreInclusive':True})
(p/'main-thread-timelines.json').write_text(json.dumps(timelines,indent=2)+'\n')
assert len(timelines)==3 and any(any(x['name']=='MajorGC' for x in row['events']) for row in timelines)
jobs=json.loads((p/'jobs.json').read_text());jobs['currentRepeat']={'handle':42131,'exit':1,'reason':'four samples exceed unchanged 100ms limit'}
(p/'jobs.json').write_text(json.dumps(jobs,indent=2)+'\n')
summary={'comparisons':results,'validCompletedSamples':57,'excludedLogicalModalControlSamples':1,'bridgeParseTotalMsRange':[min(parser_totals),max(parser_totals)],'storageTotalMsRange':[min(store_totals),max(store_totals)],'nativeSharedLockWaitMsRange':[min(lock_waits),max(lock_waits)],'serviceStartAfterLockAcquisitionMs':load_deltas,'visualModalComparison':visual,'stableArtifactFiles':len(actual),'stableSelectedSourceInputs':len(after),'productionChanges':False,'thresholdChanged':False,'productionLatencyClaim':False,'jobs':jobs,'goal':'active'}
(p/'diagnosis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['jobs','comparisons']},indent=2))
