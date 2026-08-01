import {z} from "zod";
import {validateCallableResponse} from "../validation/callableValidation";

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
});
