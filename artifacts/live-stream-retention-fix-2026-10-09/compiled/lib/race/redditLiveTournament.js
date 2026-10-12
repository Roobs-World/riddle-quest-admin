"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRedditLiveTournamentRun = readRedditLiveTournamentRun;
const raceLiveTournament_1 = require("./raceLiveTournament");
/** Reddit official scores resolve only owned Reddit live victories. */
function readRedditLiveTournamentRun(transaction, db, userId, ticketId) {
    return (0, raceLiveTournament_1.readProviderLiveTournamentRun)(transaction, db, userId, ticketId, "reddit");
}
//# sourceMappingURL=redditLiveTournament.js.map