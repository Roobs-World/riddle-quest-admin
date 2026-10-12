"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
const app = __importStar(require("firebase-admin"));
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const database_1 = require("firebase-admin/database");
/** Provides legacy behavior. */
const legacy = app;
/** Provides firestore behavior. */
const firestore = legacy.firestore ?? firestore_1.getFirestore;
firestore.FieldPath ??= firestore_1.FieldPath;
firestore.FieldValue ??= firestore_1.FieldValue;
firestore.Timestamp ??= firestore_1.Timestamp;
/** Provides admin behavior. */
exports.admin = {
    ...app,
    auth: legacy.auth ?? auth_1.getAuth,
    firestore,
    storage: legacy.storage ?? storage_1.getStorage,
    database: legacy.database ?? database_1.getDatabase,
};
//# sourceMappingURL=firebaseAdmin.js.map