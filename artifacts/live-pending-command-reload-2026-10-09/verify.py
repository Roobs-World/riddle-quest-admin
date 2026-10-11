from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
source=json.loads((root/'source-before.json').read_text());assert source==json.loads((root/'source-verified.json').read_text())
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest for p,digest in source.items())
journeys=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  rows=json.loads((root/f'{engine}-{mode}'/'observations.json').read_text())
  assert all(row['actual']==row['expected'] for row in rows)
  assert len({(row['width'],row['scenario']) for row in rows})==6 and len(rows)==42
  behavior=[row for row in rows if row['name']=='current recovery behavior for independently typed cells']
  assert len(behavior)==6
  assert all(row['actual']==(['e','',''] if row['scenario']=='hint' else ['','','','']) for row in behavior)
  journeys+=6;checks+=42
print('Verified: 24 pending-command reload journeys, 168 checks; no held command replay; selected sources unchanged.')
