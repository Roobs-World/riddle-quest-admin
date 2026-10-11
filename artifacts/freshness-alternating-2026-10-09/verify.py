import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
manifest=json.loads((root/'source-before.json').read_text())
assert manifest==json.loads((root/'source-verified.json').read_text())
assert all(hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest for name,digest in manifest.items())
compiled=json.loads((root/'compiled-hashes.json').read_text())
assert compiled['baseline'].keys()==compiled['candidate'].keys()
assert [name for name in compiled['baseline'] if compiled['baseline'][name]!=compiled['candidate'][name]]==['race/raceMatchmaking.js']
log=(root/'run.log').read_text()
assert 'Script exited successfully (code 0)' in log
positions=[]
for pair in range(5):
 for variant in (['candidate','baseline'] if pair%2 else ['baseline','candidate']):
  label=f'pair-{pair}-{variant}'
  positions.append(log.index(label+' passed'))
  report=json.loads((root/(label+'.json')).read_text())
  assert report['passed'] and report['iterations']==5 and len(report['results'])==10
  assert sum(row['observations'] for row in report['results'])==50
  assert all(all(row['checks'].values()) for row in report['results'])
  fresh=next(row for row in report['results'] if row['scenario']=='freshness' and row['phase']=='new')
  assert fresh['documentReadAttempts']['p50']==(167 if variant=='baseline' else 107)
  assert fresh['transactionDocumentReadBatches']['p50']==(69 if variant=='baseline' else 24)
assert positions==sorted(positions)
cleanup=json.loads((root/'cleanup.json').read_text())
assert cleanup['allClosed'] and cleanup['compiledVariantsRemoved']
assert not Path('/tmp/freshness-alternating-20261009a').exists()
print('Five alternating pairs, 500 measured lookups, source freeze and cleanup verified.')
