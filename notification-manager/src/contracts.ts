import {z} from "zod";

const Count = z.number().int().nonnegative().safe();
export const ImageUrl = z.string().max(2048).refine(value => {
  if (/[\u0000-\u001f\u007f]/u.test(value)) return false;
  try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash;} catch {return false;}
});
export const Campaign = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/u),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  imageUrl: ImageUrl.nullable(),
  target: z.string().min(1).max(64),
  sendAt: z.iso.datetime({offset: true}),
  status: z.enum(["queued", "sending", "complete", "cancelled"]),
  createdAt: z.iso.datetime({offset: true}),
  updatedAt: z.iso.datetime({offset: true}),
  counts: z.object({attempted: Count, accepted: Count, failed: Count, uncertain: Count, skipped: Count}).strict(),
}).strict();
export type Campaign = z.infer<typeof Campaign>;

export const ManagementConfiguration = z.object({
  platforms: z.array(z.object({id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u), origin: z.url()}).strict()).max(100),
  pushOnly: z.literal(true),
}).strict();
export type ManagementConfiguration = z.infer<typeof ManagementConfiguration>;

export const CampaignEnvelope = z.object({campaign: Campaign}).strict();
export const CampaignList = z.object({campaigns: z.array(Campaign).max(100), nextCursor: z.string().max(2048).nullable()}).strict();

export type CampaignRequest = Readonly<{
  requestId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  target: string;
  sendAt: string | null;
}>;

export const statusLabels: Record<Campaign["status"], string> = {
  queued: "Scheduled",
  sending: "Sending",
  complete: "Complete",
  cancelled: "Cancelled",
};

/** Human-readable platform names remain separate from service identifiers. */
export function platformLabel(target: string): string {
  if (target === "all") return "All registered platforms";
  return target.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
