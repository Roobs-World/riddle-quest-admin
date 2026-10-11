from pathlib import Path
import hashlib,json,subprocess,statistics
r=Path.cwd();e=r/'artifacts/host-player-latency-2026-10-08'
subprocess.run(['python3',str(e/'source-manifest.py'),'source-terminal'],check=True)
assert json.loads((e/'source-terminal.json').read_text())==json.loads((r/'artifacts/host-startup-work-2026-10-08/source-terminal.json').read_text())
for label,directory in [('baseline','host-expired-riddle-2026-10-08'),('current','host-startup-work-2026-10-08')]:
 hashes=json.loads((e/f'{label}-build-hashes.json').read_text())
 for key,value in hashes.items():assert hashlib.sha256((r/'artifacts'/directory/'built'/key).read_bytes()).hexdigest()==value
for name,value in json.loads((e/'harness-hashes.json').read_text()).items():assert hashlib.sha256((e/name).read_bytes()).hexdigest()==value
summary=json.loads((e/'summary.json').read_text())
for name in ['measurements.json','diagnostic-measurements.json']:
 rows=json.loads((e/name).read_text());assert len(rows)==20
 for engine in ['chromium','firefox']:
  for side in ['baseline','current']:
   selected=[x for x in rows if x['engine']==engine and x['side']==side];assert len(selected)==5
   for row in selected:
    assert not row['errors'] and not row['external'] and not row['trace']['unhandled'];assert row['feedbackMs']<250
    events=row['trace']['events'];assert any(x['type']=='game:submitGuess' for x in events);assert any(x.get('operation')=='guess' for x in events);assert any(x['type']=='host:riddleLoaded' and x['riddleId']=='classic-fake-1' for x in events)
   if name=='measurements.json':
    for metric in ['firstRiddleMs','readyToRiddleMs','feedbackMs']:
     values=[x[metric] for x in selected];assert summary[engine][side][metric]=={'medianMs':statistics.median(values),'rangeMs':[min(values),max(values)]}
assert not summary['wallClockSpeedupClaimed'];assert not summary['goalComplete']
print('Verified 40 real built-game runs, held authority delivery, source/artifact identity and timing summaries; goal remains active')
