import {jest} from "@jest/globals";
import {UsernameSchema} from "../validation/requestSchemas";
import {createJestUser, createReservedJestUser} from "../jest/jestUser";

describe("Jest user defaults", () => {
  it("creates deterministic display-safe usernames with 76 bits of identity-derived entropy", () => {
    const first = String(createJestUser("uid-1", "player-1").username);
    const repeated = String(createJestUser("uid-1", "player-1").username);
    const second = String(createJestUser("uid-2", "player-2").username);

    expect(first).toMatch(/^Jest [0-9a-f]{19}$/);
    expect([...first]).toHaveLength(24);
    expect(UsernameSchema.parse(first)).toBe(first);
    expect(repeated).toBe(first);
    expect(second).not.toBe(first);
  });

  it("adds normalized ownership fields and creates the initial reservation", () => {
    const create = jest.fn();
    const transaction = {create};
    const db = {
      collection: (collection: string) => ({
        doc: (id: string) => ({path: `${collection}/${id}`}),
      }),
    };

    const user = createReservedJestUser(
      transaction as never,
      db as never,
      "uid-1",
      "player-1",
    );

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
