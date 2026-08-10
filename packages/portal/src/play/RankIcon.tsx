import type {RankIconName} from "./ranks";

/** Provides rank icon behavior. */
export function RankIcon({name}: {name: RankIconName}) {
  const commonProps = {
    "aria-hidden": true,
    className: "rank-icon",
    "data-rank-icon": name,
    fill: "none",
    viewBox: "0 0 48 48",
  } as const;

  switch (name) {
    case "telescope":
      return (
        <svg {...commonProps}>
          <path d="m9 17 24-8 4 11-24 8zM8 15l5 15M30 11l4 11M22 26v6M22 32l-8 9M22 32l8 9" />
          <circle cx="39" cy="8" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "compass-rose":
      return (
        <svg {...commonProps}>
          <circle cx="24" cy="24" r="17" />
          <path d="m29 19-8 2-2 8 8-2zM24 4v5M24 39v5M4 24h5M39 24h5" />
          <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "map-marker-path":
      return (
        <svg {...commonProps}>
          <path d="M28 18c0 6-7 12-7 12s-7-6-7-12a7 7 0 1 1 14 0Z" />
          <circle cx="21" cy="18" r="2.5" />
          <path d="M7 39c3-5 7-7 12-5s8 3 13-1 8-1 9 4" strokeDasharray="3 3" />
        </svg>
      );
    case "shield-star":
      return (
        <svg {...commonProps}>
          <path d="M24 5c5 4 10 5 15 5v11c0 11-6 17-15 22C15 38 9 32 9 21V10c5 0 10-1 15-5Z" />
          <path d="m24 14 2.7 5.4 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.4-4.2 6-.9z" />
        </svg>
      );
    case "crystal-ball":
      return (
        <svg {...commonProps}>
          <circle cx="24" cy="20" r="14" />
          <path d="M16 35h16l4 7H12zM18 17c3-5 8-6 13-3M20 24c2 2 5 3 8 1" />
          <circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "star-four-points":
      return (
        <svg {...commonProps}>
          <path d="M24 4c2 12 8 18 20 20-12 2-18 8-20 20-2-12-8-18-20-20 12-2 18-8 20-20Z" />
          <path d="M37 5c.7 4 2.7 6 7 7-4.3.7-6.3 2.7-7 7-.7-4.3-2.7-6.3-7-7 4.3-1 6.3-3 7-7Z" />
        </svg>
      );
    case "weather-night":
      return (
        <svg {...commonProps}>
          <path d="M35 33A17 17 0 0 1 16 7a17 17 0 1 0 19 26Z" />
          <path d="m34 9 1.4 3.6L39 14l-3.6 1.4L34 19l-1.4-3.6L29 14l3.6-1.4zM40 24l.8 2.2L43 27l-2.2.8L40 30l-.8-2.2L37 27l2.2-.8z" />
        </svg>
      );
    case "crown":
      return (
        <svg {...commonProps}>
          <path d="m7 15 9 8 8-14 8 14 9-8-4 23H11zM12 38h24M14 31h20" />
          <circle cx="7" cy="13" r="2" fill="currentColor" stroke="none" />
          <circle cx="24" cy="7" r="2" fill="currentColor" stroke="none" />
          <circle cx="41" cy="13" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
