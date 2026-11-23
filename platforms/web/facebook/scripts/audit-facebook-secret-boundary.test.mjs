import assert from "node:assert/strict";
import {test} from "node:test";
import {auditFacebookSecretBoundary} from "./audit-facebook-secret-boundary.mjs";

const valid = () => ({
  browserSources: [{name: "entry.ts", source: "export const platform = 'facebook';"}],
  browserEnvironmentSources: [{name: ".env.facebook", source: "VITE_PLATFORM_TARGET=facebook"}],
  workflowSources: [{name: "ci.yml", source: "run: pnpm check:facebook-secrets"}],
  identityEndpointSource: `
    const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");
    const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
    const options = {secrets: [facebookAppSecret, facebookUidSecret]};`,
  deletionEndpointSource: `
    const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");
    const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
    onRequest({secrets: [facebookAppSecret, facebookUidSecret]});`,
  accountDeletionSource: `
    const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
    onCall({secrets: [facebookUidSecret]});`,
});

test("accepts the exact server-only binding contract", () => {
  assert.deepEqual(auditFacebookSecretBoundary(valid()), []);
});

test("rejects browser/config identifiers and CI secret-value injection", () => {
  const fixture = valid();
  fixture.browserSources[0].source = "const key = 'FACEBOOK_APP_SECRET';";
  fixture.browserEnvironmentSources[0].source = "FACEBOOK_UID_SECRET=never";
  fixture.workflowSources[0].source = "run: deploy --secret '${{ secrets.FACEBOOK_APP_SECRET }}'";
  const failures = auditFacebookSecretBoundary(fixture);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /browser source\/config/u);
  assert.match(failures[1], /CI injects/u);
});

test("rejects missing, widened, or swapped Functions secret bindings", () => {
  const fixture = valid();
  fixture.identityEndpointSource = fixture.identityEndpointSource.replace(
    "[facebookAppSecret, facebookUidSecret]", "[facebookAppSecret]",
  );
  fixture.deletionEndpointSource = fixture.deletionEndpointSource.replace(
    "[facebookAppSecret, facebookUidSecret]", "[facebookUidSecret]",
  );
  fixture.accountDeletionSource += '\nconst app = defineSecret("FACEBOOK_APP_SECRET");';
  assert.deepEqual(auditFacebookSecretBoundary(fixture), [
    "Facebook identity endpoints must bind both Meta secrets.",
    "Facebook deletion callback must bind both Meta secrets.",
    "Authenticated account deletion must bind only the Facebook UID secret.",
  ]);
});
