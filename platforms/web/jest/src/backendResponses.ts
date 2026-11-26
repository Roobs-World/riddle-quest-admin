import {z} from "zod";

export const identityResponse = z.union([
  z.object({customToken: z.string().min(1), uid: z.string().min(1)}),
  z.object({status: z.literal("account-deleted")}),
]);
export const deletedResponse = z.object({accountDeleted: z.literal(true)});
export const purchaseResponse = z.object({granted: z.boolean(), purchaseToken: z.string(), coinsAwarded: z.number(), newCoins: z.number(),
  newlyUnlockedAchievementIds: z.array(z.string()).optional()});
export const referralResponse = z.object({verified: z.boolean(), references: z.array(z.string()).optional(), conversionCount: z.number().optional(),
  rewardsGranted: z.number().optional(), referredRewardsGranted: z.number().optional(), coinsPerPlayer: z.number().optional(), newCoins: z.number().optional()});
export const subscriptionResponse = z.object({verified: z.boolean(), activeSkus: z.array(z.string()), blockedSkus: z.array(z.string()).optional(),
  premiumCoinsAwarded: z.number().optional(), newCoins: z.number().optional()});
export const deletedErrorResponse = z.object({error: z.literal("account-deleted")});
