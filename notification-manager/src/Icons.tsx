const paths = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2",
  clock: "M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  refresh: "M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6m-4 9a9 9 0 0 0 15 2l3-3m0 6v-6h-6",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 10 3 3 5-6",
  logout: "M9 4H4v16h5m6-12 4 4-4 4m-7-4h11",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  check: "m5 12 4 4L19 6",
} satisfies Record<string, string>;

export function Icon({name, size = 20}: {name: keyof typeof paths; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
