"use strict";

const {createRequire} = require("node:module");
const path = require("node:path");

// Maintenance tools share the dependency owner of the deployed Functions artifact.
module.exports = createRequire(path.join(__dirname, "../..", "package.json"));
