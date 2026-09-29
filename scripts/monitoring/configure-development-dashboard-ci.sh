#!/usr/bin/env bash
set -euo pipefail
# The existing private dashboard keeps its identity, bucket and access policy.
project=riddle-quest-ec2b2
bucket=riddle-quest-monitoring-ec2b2
pool=rq-development-dashboard
provider=github-development
account_id=development-dashboard-ci
repository=$(gh repo view Grindhead/riddle-quest --json nameWithOwner --jq .nameWithOwner)
branch=$(gh repo view Grindhead/riddle-quest --json defaultBranchRef --jq .defaultBranchRef.name)
[[ "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
[[ "$branch" =~ ^[A-Za-z0-9_/-]+$ ]] || exit 1
number=$(gcloud projects describe "$project" --format='value(projectNumber)')
account="${account_id}@${project}.iam.gserviceaccount.com"
condition="assertion.repository=='${repository}' && assertion.ref=='refs/heads/${branch}' && assertion.workflow_ref=='${repository}/.github/workflows/production-readiness.yml@refs/heads/${branch}'"
if ! gcloud iam workload-identity-pools describe "$pool" --project "$project" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool" --project "$project" --location global --display-name='Development dashboard updates' --quiet
fi
if gcloud iam workload-identity-pools providers describe "$provider" --workload-identity-pool "$pool" --project "$project" --location global >/dev/null 2>&1; then
  existing=$(gcloud iam workload-identity-pools providers describe "$provider" --workload-identity-pool "$pool" --project "$project" --location global --format='value(attributeCondition)')
  [[ "$existing" == "$condition" ]] || { echo 'Existing trust differs; refusing to replace it.' >&2; exit 1; }
else
  gcloud iam workload-identity-pools providers create-oidc "$provider" --workload-identity-pool "$pool" --project "$project" --location global \
    --issuer-uri='https://token.actions.githubusercontent.com' \
    --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' --attribute-condition="$condition" --quiet
fi
if ! gcloud iam service-accounts describe "$account" --project "$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$account_id" --project "$project" --display-name='Verified development snapshot writer' --quiet
fi
role=developmentDashboardSnapshotWriter
permissions=storage.objects.create,storage.objects.delete,storage.objects.get
if gcloud iam roles describe "$role" --project "$project" >/dev/null 2>&1; then
  existing=$(gcloud iam roles describe "$role" --project "$project" --format='csv[no-heading](includedPermissions)' | tr -d '"' | tr ';' ',' )
  [[ "$existing" == "$permissions" ]] || { echo 'Existing role differs; refusing to widen it.' >&2; exit 1; }
else
  gcloud iam roles create "$role" --project "$project" --title='Development dashboard snapshot writer' --permissions="$permissions" --stage=GA --quiet
fi
gcloud storage buckets add-iam-policy-binding "gs://${bucket}" --member="serviceAccount:${account}" --role="projects/${project}/roles/${role}" \
  --condition="title=development_snapshot_only,expression=resource.name == 'projects/_/buckets/${bucket}/objects/snapshot.json',description=Verified development may update only the existing dashboard snapshot" --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$account" --project "$project" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${pool}/attribute.repository/${repository}" --quiet >/dev/null
identity="projects/${number}/locations/global/workloadIdentityPools/${pool}/providers/${provider}"
gh variable set DEVELOPMENT_DASHBOARD_WIF_PROVIDER --repo "$repository" --body "$identity"
gh variable set DEVELOPMENT_DASHBOARD_SERVICE_ACCOUNT --repo "$repository" --body "$account"
printf 'Configured verified default-branch workflow delivery to the existing private dashboard.\n'
