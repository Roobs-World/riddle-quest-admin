import {JestAccountDeletedError, assertJestAccountActive, respondToDeletedJestAccount} from "../../../../../firebase-functions/src/shared/accountDeletion";

describe("Jest account-deletion boundary", () => {
  it("maps only the expected tombstone error to the stable HTTP response", () => {
    expect(() => assertJestAccountActive({exists: true} as never)).toThrow(JestAccountDeletedError);
    expect(() => assertJestAccountActive({exists: false} as never)).not.toThrow();
    /** Provides response behavior. */
    const response = {status: jest.fn(), json: jest.fn()};
    response.status.mockReturnValue(response);

    expect(respondToDeletedJestAccount(new JestAccountDeletedError(), response)).toBe(true);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({error: "account-deleted"});
    expect(respondToDeletedJestAccount(new Error("other"), response)).toBe(false);
  });
});
