import assert from "node:assert/strict";
import test from "node:test";
import {getHtml5DistributionDefinition} from "./package-html5-platform.mjs";

test("distribution targets have distinct immutable artifact names and honest release boundaries", () => {
  const targets = ["itch", "crazygames", "newgrounds", "gamejolt", "coolmath", "armor", "gamepix", "addictinggames", "htmlgames", "playkovo", "kongregate", "lagged", "gamedistribution", "gamemonetize", "yandex", "telegram"];
  const definitions = targets.map(getHtml5DistributionDefinition);
  assert.equal(new Set(definitions.map(({artifact}) => artifact)).size, targets.length);
  assert.ok(definitions.every(({artifact}) => artifact.endsWith(".zip")));
  assert.ok(definitions.every(({boundary}) => /manual|Butler/iu.test(boundary)));
  assert.throws(() => getHtml5DistributionDefinition("unknown"), /Unknown HTML5 distribution target/u);
});
