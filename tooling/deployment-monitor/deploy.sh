#!/usr/bin/env bash
set -euo pipefail
monitor_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
monitor_project=riddle-quest-ec2b2
monitor_region=us-central1
monitor_service=riddle-quest-monitoring
monitor_account="deployment-monitor@${monitor_project}.iam.gserviceaccount.com"
monitor_bucket=riddle-quest-monitoring-ec2b2

cd "$monitor_root"
node --test tooling/deployment-monitor/test/*.test.mjs
pnpm --dir docs/reports/platform-release-readiness build
cp docs/reports/platform-release-readiness/dist/index.html tooling/deployment-monitor/index.html
cp docs/reports/platform-release-readiness/src/data.json tooling/deployment-monitor/seed.json

if ! gcloud iam service-accounts describe "$monitor_account" --project "$monitor_project" >/dev/null 2>&1; then
  gcloud iam service-accounts create deployment-monitor --project "$monitor_project" --display-name='Deployment metrics collector'
fi
if ! gcloud storage buckets describe "gs://$monitor_bucket" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$monitor_bucket" --project "$monitor_project" --location="$monitor_region" --uniform-bucket-level-access --public-access-prevention
fi
monitor_roles="$(gcloud projects get-iam-policy "$monitor_project" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:$monitor_account" --format='value(bindings.role)')"
for monitor_role in roles/logging.viewer roles/run.viewer; do
  if ! [[ $'\n'"$monitor_roles"$'\n' == *$'\n'"$monitor_role"$'\n'* ]]; then
    gcloud projects add-iam-policy-binding "$monitor_project" --member="serviceAccount:$monitor_account" --role="$monitor_role" --condition=None --quiet --format=none
  fi
done
gcloud storage buckets add-iam-policy-binding "gs://$monitor_bucket" --member="serviceAccount:$monitor_account" --role=roles/storage.objectUser --format=none
# This dedicated bucket also holds the renewable provider connection. Remove the
# default object-read grant for project viewers; dashboard reads go through IAM.
monitor_viewers="$(gcloud storage buckets get-iam-policy "gs://$monitor_bucket" --format=json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.parse(s).bindings.filter(b=>b.role==="roles/storage.legacyObjectReader").flatMap(b=>b.members).join("\n")))')"
if [[ $monitor_viewers == *"projectViewer:$monitor_project"* ]]; then
  gcloud storage buckets remove-iam-policy-binding "gs://$monitor_bucket" --member="projectViewer:$monitor_project" --role=roles/storage.legacyObjectReader --format=none
fi

gcloud run deploy "$monitor_service" --project "$monitor_project" --region "$monitor_region" \
  --source tooling/deployment-monitor --service-account "$monitor_account" \
  --no-allow-unauthenticated --ingress=all --max-instances=1 --memory=256Mi --cpu=1 \
  --timeout=180 --set-env-vars="GOOGLE_CLOUD_PROJECT=$monitor_project,MONITOR_BUCKET=$monitor_bucket" --quiet
gcloud run services add-iam-policy-binding "$monitor_service" --project "$monitor_project" --region "$monitor_region" \
  --member="serviceAccount:$monitor_account" --role=roles/run.invoker --format=none
monitor_url="$(gcloud run services describe "$monitor_service" --project "$monitor_project" --region "$monitor_region" --format='value(status.url)')"
printf 'On-demand monitor deployed at %s. No scheduled collection is installed.\n' "$monitor_url"
