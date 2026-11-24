import {CampaignSummary} from "../src/contracts.js";
import {notificationDatabase} from "./database.js";
import {ApiError} from "./errors.js";
import type {Deadline} from "./deadline.js";

const SummaryWindow = CampaignSummary.pick({dayStart: true, dayEnd: true}).refine(value => {
  const duration = Date.parse(value.dayEnd) - Date.parse(value.dayStart);
  return Number.isFinite(duration) && duration > 0 && duration <= 26 * 3_600_000;
});

export async function readCampaignSummary(requestUrl: string | undefined, deadline: Deadline) {
  const search = new URL(requestUrl ?? "/", "https://notification.invalid").searchParams;
  if (search.getAll("dayStart").length !== 1 || search.getAll("dayEnd").length !== 1) {
    throw new ApiError(400, "notification-summary-window-invalid");
  }
  const window = SummaryWindow.safeParse(Object.fromEntries(search));
  if (!window.success) throw new ApiError(400, "notification-summary-window-invalid");
  const database = notificationDatabase(deadline);
  const [upcoming, accepted] = await Promise.all([
    database.from("notification_campaigns").select("id", {count: "exact", head: true}).in("status", ["queued", "sending"]),
    database.from("notification_attempts").select("id", {count: "exact", head: true}).eq("phase", "accepted")
      .gte("finished_at", window.data.dayStart).lt("finished_at", window.data.dayEnd),
  ]);
  if (upcoming.error || accepted.error || upcoming.count === null || accepted.count === null) {
    throw new ApiError(503, "notification-summary-unavailable");
  }
  return CampaignSummary.parse({...window.data, upcoming: upcoming.count, acceptedToday: accepted.count});
}
