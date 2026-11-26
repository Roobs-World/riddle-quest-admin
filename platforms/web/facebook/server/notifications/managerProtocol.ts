import {z} from "zod";
import {ManagerDispatch, ManagerDispatchResult, ManagerReference, ManagerRegistration, ManagerRegistrationReceipt,
  withinCampaignBudget} from "../../../../../src/notifications/contracts/managerBridge.js";

export const FacebookRegistration = ManagerRegistration.extend({recipientHash: ManagerReference});
export type FacebookRegistration = z.infer<typeof FacebookRegistration>;
export const FacebookRegistrationReceipt = ManagerRegistrationReceipt;
export type FacebookRegistrationReceipt = z.infer<typeof FacebookRegistrationReceipt>;

export function printableFacebookText(content: {title: string; body: string}): boolean {
  return ![...content.title, ...content.body].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export const FacebookDispatch = ManagerDispatch.extend({recipientHash: ManagerReference}).refine(withinCampaignBudget,
  "Notification content exceeds the push payload budget").refine(printableFacebookText, "Facebook notification text contains a control character");
export type FacebookDispatch = z.infer<typeof FacebookDispatch>;
export const FacebookDispatchResult = ManagerDispatchResult;
export type FacebookDispatchResult = z.infer<typeof FacebookDispatchResult>;
