"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFacebookLiveTournamentRun = readFacebookLiveTournamentRun;
const raceLiveTournament_1 = require("./raceLiveTournament");
/** Facebook official scores resolve only owned Facebook live victories. */
function readFacebookLiveTournamentRun(transaction, db, userId, ticketId) {
    return (0, raceLiveTournament_1.readProviderLiveTournamentRun)(transaction, db, userId, ticketId, "facebook");
}
//# sourceMappingURL=facebookLiveTournament.js.map