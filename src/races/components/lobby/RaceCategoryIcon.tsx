import type {RaceCategoryId} from "../../contracts/index";

/** Small line drawings use the same rounded shapes as the game controls. */
const CATEGORY_PATHS: Record<RaceCategoryId, string> = {
  history: "M4 9h16L12 4 4 9Zm2 3v7m6-7v7m6-7v7M3 22h18M4 19h16",
  geography: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z",
  music: "M10 17V5l10-2v12M10 8l10-2M10 17c0 4-7 5-7 1 0-3 7-4 7-1Zm10-2c0 4-7 5-7 1 0-3 7-4 7-1Z",
  film: "M4 3h16v18H4V3ZM8 3v18M16 3v18M4 8h4m-4 8h4m8-8h4m-4 8h4M8 12h8",
  science: "M9 3h6m-5 0v7L4 19c-.6 1 .1 2 1 2h14c.9 0 1.6-1 1-2l-6-9V3M7 15h10",
  mixed: "M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4",
};

/** Decorative category artwork ships with every multiplayer-capable target. */
export function RaceCategoryIcon({categoryId}: {
  /** Server-owned category being illustrated. */
  categoryId: RaceCategoryId;
}) {
  return <svg className="race-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={CATEGORY_PATHS[categoryId]} />
  </svg>;
}
