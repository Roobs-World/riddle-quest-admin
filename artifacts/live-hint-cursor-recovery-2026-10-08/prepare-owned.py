from pathlib import Path
import json,hashlib,difflib
r=Path.cwd();e=r/'artifacts/live-hint-cursor-recovery-2026-10-08'
old=json.loads((r/'artifacts/guess-result-recovery-2026-10-08/source-terminal.json').read_text());new=json.loads((e/'source-before.json').read_text())
changed=sorted(p for p in old.keys()|new.keys() if old.get(p)!=new.get(p));rows=[];patch=''
for p in changed:
 name=Path(p).name;b=e/('package.before.json' if name=='package.json' else name);b=b if b.exists() else None;a=r/p
 patch+=''.join(difflib.unified_diff(b.read_text().splitlines(True) if b else [],a.read_text().splitlines(True),fromfile='a/'+p if b else '/dev/null',tofile='b/'+p))
 rows.append({'path':p,'before':str(b.relative_to(r)) if b else None,'beforeSha256':hashlib.sha256(b.read_bytes()).hexdigest() if b else None,'afterSha256':new[p]})
 dest=e/'owned-after'/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(a.read_bytes())
assert len(rows)==9
(e/'owned.diff').write_text(patch);(e/'owned-files.json').write_text(json.dumps(rows,indent=2)+'\n')
pre=json.loads((e/'source-pre-documentation.json').read_text());delta=[p for p in new if new[p]!=pre[p]]
assert delta==['packages/portal/src/play/race/__tests__/liveRaceDraft.test.ts']
(e/'documentation-only-change.json').write_text(json.dumps({'changedInputs':delta,'reason':'Three TSDoc declaration comments added to the regression test; production unchanged. Final full units/static/builds repeat the corrected freeze; injected matrix predates only these comments.'},indent=2)+'\n')
