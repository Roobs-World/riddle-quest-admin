"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameplayInteractiveCallableOptions = exports.gameplayCallableOptions = void 0;
const callableSecurity_1 = require("./callableSecurity");
/** Adds gameplay beside eur3 while retaining the endpoint used by existing clients and the Reddit gateway. */
exports.gameplayCallableOptions = {
    ...callableSecurity_1.browserCallableSecurityOptions,
    region: ["us-central1", "europe-west1"],
};
/** Interactive gameplay starts instances only when requests arrive. */
exports.gameplayInteractiveCallableOptions = {
    ...exports.gameplayCallableOptions,
    minInstances: 0,
};
//# sourceMappingURL=gameplayCallableOptions.js.map