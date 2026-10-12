"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccountForUser = exports.deleteAccount = void 0;
/** Callable boundary for permanent Riddle Quest account deletion. */
var deleteAccountCallable_1 = require("./deleteAccountCallable");
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return deleteAccountCallable_1.deleteAccount; } });
/** Server-side account data removal operation. */
var deleteAccountData_1 = require("./deleteAccountData");
Object.defineProperty(exports, "deleteAccountForUser", { enumerable: true, get: function () { return deleteAccountData_1.deleteAccountForUser; } });
//# sourceMappingURL=index.js.map