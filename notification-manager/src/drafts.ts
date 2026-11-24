import {z} from "zod";

export const DraftValues = z.object({
  title: z.string().max(200), body: z.string().max(2000), imageUrl: z.string().max(2048),
  target: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u), mode: z.enum(["now", "scheduled"]),
  day: z.string().max(10), time: z.string().max(8),
}).strict();
export type DraftValues = z.infer<typeof DraftValues>;
const Attempt = z.object({fingerprint: z.string().max(16_384), id: z.uuid()}).strict();
const SavedDraft = z.object({id: z.uuid(), updatedAt: z.iso.datetime(), values: DraftValues}).strict();
export type SavedDraft = z.infer<typeof SavedDraft>;
const WorkingDraft = z.object({values: DraftValues, attempt: Attempt.nullable()}).strict();
type WorkingDraft = z.infer<typeof WorkingDraft>;
const Library = z.array(SavedDraft).max(25);
const key = (owner: string, kind: string) => `riddleQuest:notificationStudio:${encodeURIComponent(owner)}:${kind}:v1`;

function read<T extends z.ZodType>(owner: string, kind: string, schema: T): z.output<T> | null {
  const raw = localStorage.getItem(key(owner, kind));
  if (raw === null) return null;
  if (raw.length > 250_000) throw new Error("Saved drafts are too large to open.");
  const value: unknown = JSON.parse(raw);
  return schema.parse(value);
}

export function readWorkingDraft(owner: string): WorkingDraft | null {return read(owner, "working", WorkingDraft);}
export function writeWorkingDraft(owner: string, draft: WorkingDraft): void {
  localStorage.setItem(key(owner, "working"), JSON.stringify(WorkingDraft.parse(draft)));
}
export function readDraftLibrary(owner: string): SavedDraft[] {return read(owner, "library", Library) ?? [];}
export function writeDraftLibrary(owner: string, drafts: readonly SavedDraft[]): void {
  localStorage.setItem(key(owner, "library"), JSON.stringify(Library.parse(drafts)));
}

export async function importDraft(file: File): Promise<DraftValues> {
  if (file.size > 32_768) throw new Error("Choose a notification draft smaller than 32 KB.");
  const value: unknown = JSON.parse(await file.text());
  return z.object({version: z.literal(1), draft: DraftValues}).strict().parse(value).draft;
}

export function exportDraft(draft: DraftValues): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, draft: DraftValues.parse(draft)}, null, 2)], {type: "application/json"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "notification-draft.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
