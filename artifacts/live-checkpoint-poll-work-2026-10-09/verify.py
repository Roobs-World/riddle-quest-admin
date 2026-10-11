from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
source=json.loads((root/'source-before.json').read_text())
assert source==json.loads((root/'source-verified.json').read_text())
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest for p,digest in source.items())
summary=json.loads((root/'work-summary.json').read_text());assert len(summary)==8
assert all(row['reads']==5 and row['writes']==0 and row['removes']==0 for row in summary)
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  rows=json.loads((root/f'{engine}-{mode}'/'observations.json').read_text())
  assert len(rows)==16 and all(row['actual']==row['expected'] for row in rows)
print('Verified: eight journeys, 64 assertions, 40 observed reads, zero writes/removals; selected production sources unchanged.')
