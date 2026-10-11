from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
initial=json.loads((root/'source-before.json').read_text());assert len(initial)==2506 and initial==json.loads((root/'source-terminal.json').read_text())
final=json.loads((root/'source-final.json').read_text());assert all(sha(Path(p))==digest for p,digest in final.items())
owned=['packages/portal/src/play/race/logic/liveRaceDraftStorage.ts','packages/portal/src/play/race/LiveRaceGame.tsx','packages/portal/src/play/race/__tests__/liveRaceDraftStorage.test.ts']
assert {p for p in initial if initial[p]!=final[p]}==set(owned)
assert all(sha(root/'candidate'/Path(p).name)==initial[p] for p in owned)
prior=json.loads((Path('artifacts/live-checkpoint-read-deduplication-2026-10-09')/'source-verified.json').read_text())
assert all(final[p]==prior[p] for p in owned[:2])
journeys=checks=0
for engine in ['chromium','firefox']:
 for mode in ['development','production']:
  for suffix,count in [('',2),('-boundaries',12),('-writer',2),('-storage',4),('-poll',2),('-pending',6)]:
   rows=json.loads((root/(engine+'-'+mode+suffix)/'observations.json').read_text())
   assert all(row['actual']==row['expected'] for row in rows)
   assert len({(row['width'],row.get('scenario','same')) for row in rows})==count
   journeys+=count;checks+=len(rows)
assert journeys==112 and checks==688
for name,text in [('unit.log','43 passed'),('full-client.log','3095 passed'),('consumed-word-candidate.log','1 failed, 24 passed'),('final-unit.log','38 passed'),('final-client.log','3090 passed'),('final-tsdoc.log','TSDoc audit passed'),('final-file-sizes.log','Maintainable-file size audit passed')]:assert text in (root/name).read_text(),name
assert 'zzzz' not in (root/'consumed-word-candidate.log').read_text() or 'Expected: null' in (root/'consumed-word-candidate.log').read_text()
for target in ['jest','facebook','reddit','youtube','netflix','yahoo']:assert target+' build passed' in (root/'build-cohort.log').read_text()
assert 'Devvit server build passed' in (root/'build-cohort.log').read_text()
hashes=json.loads((root/'candidate-built-sha256.json').read_text());assert len(hashes)==1299 and all(sha(root/'candidate-built'/p)==digest for p,digest in hashes.items())
cleanup=json.loads((root/'cleanup.json').read_text());assert cleanup['allAbsent'] and len(cleanup['metadata'])==6
assert not Path(cleanup['buildRoot']).exists() and all(not Path(p).exists() for p in cleanup['metadata'])
print('Verified: local-marker candidate rejected by consumed-word regression; safe production restored; 3090 final client tests pass; candidate evidence and cleanup preserved.')
