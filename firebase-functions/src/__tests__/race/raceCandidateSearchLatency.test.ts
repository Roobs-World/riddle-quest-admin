import {HttpsError} from "firebase-functions/v2/https";
import {searchRaceCandidates} from "../../race/raceCandidateSearch";
import {emptyRaceMatchProfile} from "../../race/raceMatchPerformance";

it("finishes a sparse indexed search within its deadline with bounded concurrent reads", async () => {
  jest.useFakeTimers();
  try {
    /** Empty indexed intervals retain a deterministic cross-region RPC cost. */
    let inFlight = 0, peak = 0;
    /** Full query API keeps actual cursor, scope and deadline policy on the real search path. */
    const query = {
      where: () => query, orderBy: () => query, limit: () => query, startAfter: () => query,
      get: async () => {
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 300));
        inFlight--;
        return {docs: [], size: 0};
      },
    };
    /** Deterministic transport for actual indexed candidate retrieval. */
    const db = {collection: () => query} as unknown as FirebaseFirestore.Firestore;
    /** Returning players have distinct category expectations and sparse indexed intervals. */
    const profile = {...emptyRaceMatchProfile(), categories: {history: {logMs: Math.log(40000), evidence: 3}, science: {logMs: Math.log(90000), evidence: 3}}};
    /** Matches the production lookup's fifteen-second work budget. */
    const started = Date.now();
    /** Rejection is captured before advancing timers to avoid unhandled promise reports. */
    const result = searchRaceCandidates(db, "jest_owner", "jest", {locale: "en", requestId: "sparse-search"},
      profile, "sparse-search", started, undefined, () => {
        if (Date.now() - started >= 15000) throw new HttpsError("deadline-exceeded", "Search deadline exhausted.");
      }).then(value => ({value}), error => ({error}));
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({value: {documents: [], exhausted: true}});
    expect(Date.now() - started).toBeLessThan(15000);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
  } finally {jest.useRealTimers();}
});
