import {ProductPricingSchema} from "../validation/firestoreSchemas";
import type {ProductPricing} from "./catalog";

export * from "./catalog";

export const parseProductPricing = (value: unknown): ProductPricing => ProductPricingSchema.parse(value);
