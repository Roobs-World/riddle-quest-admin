import {useId, useState, type CSSProperties, type ReactNode} from "react";
import {RankIcon} from "./RankIcon";
import {RANK_FRAME_PATHS} from "./rankArtwork";
import {getRankForLevel} from "../../browser/ranks";
import {tr} from "../../../localization/browser/i18n";
import "./RankedAvatar.css";

/** Shared identity portrait with the frame earned by the player's level. */
export function RankedAvatar({avatarUrl, level = 1, fallback, size, imageClassName = "", fallbackClassName = "", showSymbolBadge = true}: {
  /** Provider-owned portrait URL, when available. */ avatarUrl?: string | null;
  /** Trusted progression level; legacy identities start with the first rank. */ level?: number;
  /** Initial or existing localized identity placeholder. */ fallback: ReactNode;
  /** Total frame diameter in pixels, including all decorations. */ size: number;
  /** Rank catalogue previews already show a large central symbol. */ showSymbolBadge?: boolean;
  /** Existing image hook used by the surrounding surface. */ imageClassName?: string;
  /** Existing placeholder hook used by the surrounding surface. */ fallbackClassName?: string;
}) {
  /** The URL that failed, so changing portraits automatically retries the new URL. */
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  /** Rank is derived on every render so level changes update every portrait. */
  const rank = getRankForLevel(level);
  /** Unique paint-server identifier permits many framed avatars on one page. */
  const gradientId = useId();
  /** Shared palette and dimensions for the image and scalable frame. */
  const style = {"--avatar-size": `${size}px`, "--avatar-color": rank.color, "--avatar-glow": rank.glowColor, "--avatar-highlight": rank.highlightColor} as CSSProperties;
  return <span className="ranked-avatar" data-avatar-rank={rank.id} data-avatar-material={rank.material} title={`${tr(rank.nameKey)} · ${tr(rank.materialKey)}`} style={style}>
    {avatarUrl && avatarUrl !== failedUrl ?
      <img className={`ranked-avatar-image ${imageClassName}`} src={avatarUrl} alt="" referrerPolicy="no-referrer"
        onError={() => setFailedUrl(avatarUrl)} /> :
      <span className={`ranked-avatar-fallback ${fallbackClassName}`} aria-hidden="true">{fallback}</span>}
    <svg className="ranked-avatar-frame" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={rank.glowColor} />
        <stop offset="0.3" stopColor={rank.highlightColor} />
        <stop offset="0.55" stopColor={rank.glowColor} />
        <stop offset="0.8" stopColor={rank.highlightColor} />
        <stop offset="1" stopColor={rank.color} />
      </linearGradient></defs>
      <circle className="ranked-avatar-frame-base" cx="50" cy="50" r="44" stroke={`url(#${gradientId})`} />
      <circle cx="50" cy="50" r="40" stroke={rank.color} strokeWidth="1" />
      <circle cx="50" cy="50" r="48" stroke={rank.color} strokeWidth="1" />
      <path className="ranked-avatar-ornament" d={RANK_FRAME_PATHS[rank.icon]} strokeLinecap="round" />
    </svg>
    {showSymbolBadge ? <span className="ranked-avatar-symbol" aria-hidden="true"><RankIcon name={rank.icon} /></span> : null}
  </span>;
}
