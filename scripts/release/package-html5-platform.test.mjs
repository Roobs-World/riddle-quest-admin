import assert from "node:assert/strict";
import test from "node:test";
import {getHtml5DistributionDefinition, listHtml5DistributionDefinitions} from "./package-html5-platform.mjs";

test("distribution targets have distinct immutable artifact names and honest release boundaries", () => {
  const targets = listHtml5DistributionDefinitions().map(({target}) => target);
  const definitions = targets.map(getHtml5DistributionDefinition);
  assert.equal(new Set(definitions.map(({artifact}) => artifact)).size, targets.length);
  assert.ok(definitions.every(({artifact}) => artifact.endsWith(".zip")));
  assert.ok(definitions.every(({boundary}) => /manual|Butler/iu.test(boundary)));
  assert.throws(() => getHtml5DistributionDefinition("unknown"), /Unknown HTML5 distribution target/u);
  for (const target of ["web", "pwa", "microsoft-pwa", "pwa-directory", "pwastore"]) {
    assert.throws(() => getHtml5DistributionDefinition(target), /Unknown HTML5 distribution target/u);
  }
});
