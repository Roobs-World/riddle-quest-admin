import {ProductPricingSchema} from "../../platform/contracts/firestoreSchemas";
import type {ProductPricing} from "./catalog";

export * from "./catalog";

/** Parses product pricing. */
export const parseProductPricing = (value: unknown): ProductPricing => ProductPricingSchema.parse(value);
