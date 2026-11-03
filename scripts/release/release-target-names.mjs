import {getReleaseDefinition} from "./release-registry.mjs";

export const expectedName = plan => getReleaseDefinition(plan.target).displayName;
