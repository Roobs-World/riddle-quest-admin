from pathlib import Path
import json,itertools
root=Path('artifacts/content-hex-decoding-audit-2026-10-09');results=[]
for engine in ['chromium','firefox']:
 source=json.loads((root/(engine+'-cold-browser.json')).read_text())
 for locale in ['en','hi']:
  values=[row['elapsedMs'] for row in source['samples'] if row['locale']==locale]
  names=[row['side'] for row in source['samples'] if row['locale']==locale]
  ranks=[1+sum(v<x for v in values)+(sum(v==x for v in values)-1)/2 for x in values]
  observed=sum(rank for rank,name in zip(ranks,names) if name=='candidate');center=9*19/2;distance=abs(observed-center)
  statistics=[sum(ranks[i] for i in indices) for indices in itertools.combinations(range(18),9)]
  p=sum(abs(stat-center)>=distance for stat in statistics)/len(statistics)
  results.append({'engine':engine,'locale':locale,'twoSidedExactPermutationRankP':p,'permutations':len(statistics),'scope':'Exploratory same-machine nine first-use samples per side, ties averaged; not player-population latency'})
(root/'cold-rank-check.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
