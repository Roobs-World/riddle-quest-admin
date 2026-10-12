# Shared task and requirements register

The shared dashboard is https://riddle-quest-release-dashboard.vercel.app. Its Tasks and requirements tab combines Riddle Quest and BeeHive records. Release, monitoring, delivery and outreach views retain their existing evidence and identity.

The register includes all Riddle Quest development manifests, repository Markdown checklists, progress reports since 2 October, recorded release and outreach actions, GitHub issues for both projects, explicit documented requirements and BeeHive handoff/content follow-ups. It records source paths, line numbers, captured revisions, health and collection timestamps. Other repositories and chat-only requests require importing before they are represented.

Status comes from evidence. Development verified requires work receipts for the current revision and source digest, passing required checks with verified logs, and matching artifact hashes across every manifest target. Historical receipts remain available as evidence but do not establish current verification. Reported complete comes from checked source checklists or closed issues. Tasks without matching receipts remain Verification pending. Provider submission, review, approval, activation and publication retain their own states.

## AI access

The existing public Vercel dashboard now exposes a read-only API. No key is required. Project task data has the same public visibility as the dashboard; do not import credentials or private learner/admin records.

- `/api/v1` lists endpoints and caveats.
- `/api/openapi.json` describes the API for tool import.
- `/api/v1/projects` lists projects.
- `/api/v1/tasks` and `/api/v1/tasks/{id}` list tasks or return one task with its linked requirements.
- `/api/v1/requirements` and `/api/v1/requirements/{id}` expose policy, acceptance, verification and gate requirements.
- `/api/v1/documents` indexes source requirement/evidence documents by repository path and digest. It does not publish their entire bodies.
- `/api/v1/coverage` records source retrieval results.
- `/api/v1/context` returns the requirements and task summaries with links to full task descriptions, optionally with `project=beehive` or `project=riddle-quest`.
- `/api/v1/export` redirects to a complete unabridged JSON snapshot download.
- `/api/v1/health` returns freshness, digest and counts.
- `/llms.txt` gives machine-readable usage guidance.

List endpoints support `project`, `status`, `kind`, `q`, `taskId`, `limit` and `offset`. Limit defaults to 50 and cannot exceed 200. Follow the returned `next` path to collect every page. IDs are stable and must be URL-encoded in individual-record paths. Requirements use `taskId` to select linked records. CORS allows read access; POST/PUT/PATCH/DELETE return 405. ETags support conditional reads.

```sh
curl 'https://riddle-quest-release-dashboard.vercel.app/api/v1/tasks?project=beehive'
curl 'https://riddle-quest-release-dashboard.vercel.app/api/v1/tasks?status=Verification%20pending&limit=100'
curl 'https://riddle-quest-release-dashboard.vercel.app/api/v1/context?project=riddle-quest'
```

## Refresh and deploy

From the Riddle Quest repository, with the adjacent BeeHive repository available, the GitHub CLI signed in and the installed Data plugin present:

```sh
npm run dashboard:sync
npm run dashboard:test
npm run dashboard:build
npm run dashboard:deploy
```

Sync reads both repositories, GitHub issues and BeeHive production health. It fails on missing sources, duplicate task IDs or issue pagination overflow rather than claiming complete coverage. The packaged HTML and API use the same snapshot and identity. Build follows the app's installed-runtime authoring checks and creates Vercel Build Output API files. Deploy targets the existing project and team using prebuilt outputs. It does not deploy any game or change provider publication holds.

This is a published snapshot, not a background watcher. Run the commands after task changes. If another agent edits the source during a sync, run it again after the source settles. A read-only AI request cannot update the register. The separate private Cloud Run monitoring collector remains independent of this public Vercel task register.
