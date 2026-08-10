import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";

describe("callable response serialization", () => {
  it("recursively omits optional undefined fields before Firebase transport", () => {
    const schema = z.object({
      id: z.string(),
      optional: z.string().optional(),
      nested: z.object({optional: z.string().optional()}),
      items: z.array(z.object({optional: z.string().optional()})),
    });

    expect(
      validateCallableResponse(
        schema,
        {
          id: "race-1",
          optional: undefined,
          nested: {optional: undefined},
          items: [{optional: undefined}],
        },
        "startRaceRun",
      ),
    ).toEqual({id: "race-1", nested: {}, items: [{}]});
  });

  it("preserves intentional null values", () => {
    const schema = z.object({value: z.string().nullable()});
    expect(validateCallableResponse(schema, {value: null}, "nullableResponse")).toEqual({value: null});
  });

  it("returns valid request data", () => {
    expect(validateCallableRequest(z.object({name: z.string()}), {name: "Ada"}, "rename")).toEqual({name: "Ada"});
  });

  it("reports invalid requests with the schema issue path", () => {
    expect(() => validateCallableRequest(z.object({name: z.string()}), {name: 4}, "rename")).toThrow(
      new HttpsError("invalid-argument", "Invalid request payload for rename: name: Invalid input: expected string, received number"),
    );
    expect(() => validateCallableRequest(z.string(), 4, "rename")).toThrow(
      new HttpsError("invalid-argument", "Invalid request payload for rename: root: Invalid input: expected string, received number"),
    );
  });

  it("supports fixed and computed invalid-request messages", () => {
    const schema = z.string();
    expect(() => validateCallableRequest(schema, 1, "fixed", "Choose another value.")).toThrow(
      new HttpsError("invalid-argument", "Choose another value."),
    );
    expect(() => validateCallableRequest(schema, 1, "computed", (error) => `Issues: ${error.issues.length}`)).toThrow(
      new HttpsError("invalid-argument", "Issues: 1"),
    );
  });

  it("reports invalid server responses as internal errors", () => {
    expect(() => validateCallableResponse(z.object({id: z.string()}), {}, "createRace")).toThrow(
      new HttpsError("internal", "Invalid response payload from createRace: id: Invalid input: expected string, received undefined"),
    );
  });
});
