import {z} from "zod";

/** Only a project URL and a modern publishable key may enter the browser configuration. */
export const PublicSupabaseSettings = z.object({
  url: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
  }),
  key: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/u).max(4096),
});
