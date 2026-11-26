import {z} from "zod";
import {ManagerDispatch, ManagerDispatchResult, ManagerReference, ManagerRegistration, ManagerRegistrationReceipt,
  withinCampaignBudget} from "../../../../src/notifications/contracts/managerBridge.js";

export const AndroidRegistration = z.object({version: ManagerRegistration.shape.version, tokenHash: ManagerReference,
  ...ManagerRegistration.omit({version: true}).shape}).strict();
export type AndroidRegistration = z.infer<typeof AndroidRegistration>;
export const AndroidRegistrationReceipt = ManagerRegistrationReceipt;
export type AndroidRegistrationReceipt = z.infer<typeof AndroidRegistrationReceipt>;

export const AndroidDispatch = z.object({version: ManagerDispatch.shape.version, tokenHash: ManagerReference,
  ...ManagerDispatch.omit({version: true}).shape}).strict().refine(withinCampaignBudget,
  "Notification content exceeds the push payload budget");
export type AndroidDispatch = z.infer<typeof AndroidDispatch>;
export const AndroidDispatchResult = ManagerDispatchResult;
export type AndroidDispatchResult = z.infer<typeof AndroidDispatchResult>;
