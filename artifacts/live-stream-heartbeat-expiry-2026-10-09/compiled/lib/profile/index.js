"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateUsername = exports.syncJestAvatar = exports.updateAvatar = void 0;
/** Profile-related callable Cloud Functions. */
var updateAvatar_1 = require("./updateAvatar");
Object.defineProperty(exports, "updateAvatar", { enumerable: true, get: function () { return updateAvatar_1.updateAvatar; } });
var syncJestAvatar_1 = require("./syncJestAvatar");
Object.defineProperty(exports, "syncJestAvatar", { enumerable: true, get: function () { return syncJestAvatar_1.syncJestAvatar; } });
var updateUsername_1 = require("./updateUsername");
Object.defineProperty(exports, "updateUsername", { enumerable: true, get: function () { return updateUsername_1.updateUsername; } });
var accountDeletion_1 = require("./accountDeletion");
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return accountDeletion_1.deleteAccount; } });
//# sourceMappingURL=index.js.map