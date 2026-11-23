import {jest} from "@jest/globals";
import {UsernameSchema} from "@riddle-quest/core/validation/requestSchemas";
import {createJestUser, createReservedJestUser} from "../jestUser";

describe("Jest user defaults", () => {
  it("creates deterministic display-safe usernames with 76 bits of identity-derived entropy", () => {
    /** Provides first behavior. */
    const first = String(createJestUser("uid-1", "player-1").username);
    /** Provides repeated behavior. */
    const repeated = String(createJestUser("uid-1", "player-1").username);
    /** Provides second behavior. */
    const second = String(createJestUser("uid-2", "player-2").username);

    expect(first).toMatch(/^Jest [0-9a-f]{19}$/);
    expect([...first]).toHaveLength(24);
    expect(UsernameSchema.parse(first)).toBe(first);
    expect(repeated).toBe(first);
    expect(second).not.toBe(first);
  });

  it("adds normalized ownership fields and creates the initial reservation", () => {
    /** Provides create behavior. */
    const create = jest.fn();
    /** Provides transaction behavior. */
    const transaction = {create};
    /** Provides db behavior. */
    const db = {
      collection: (collection: string) => ({
        doc: (id: string) => ({path: `${collection}/${id}`}),
      }),
    };

    /** Provides r. */
    const user = createReservedJestUser(transaction as never, db as never, "uid-1", "player-1");

    expect(user).toMatchObject({
      username: expect.stringMatching(/^Jest [0-9a-f]{19}$/),
      usernameNormalized: expect.stringMatching(/^jest [0-9a-f]{19}$/),
      usernameReservationId: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(create).toHaveBeenCalledWith(
      {path: `usernameReservations/${String(user.usernameReservationId)}`},
      expect.objectContaining({userId: "uid-1", username: user.username}),
    );
  });
});
