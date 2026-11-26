import en from "../../locales/en/achievements.json";
import enStats from "../../locales/en/stats.json";
import es from "../../locales/es/achievements.json";
import esStats from "../../locales/es/stats.json";
import pt from "../../locales/pt/achievements.json";
import ptStats from "../../locales/pt/stats.json";
import fr from "../../locales/fr/achievements.json";
import frStats from "../../locales/fr/stats.json";
import de from "../../locales/de/achievements.json";
import deStats from "../../locales/de/stats.json";
import ja from "../../locales/ja/achievements.json";
import jaStats from "../../locales/ja/stats.json";
import ko from "../../locales/ko/achievements.json";
import koStats from "../../locales/ko/stats.json";
import hi from "../../locales/hi/achievements.json";
import hiStats from "../../locales/hi/stats.json";
import ru from "../../locales/ru/achievements.json";
import ruStats from "../../locales/ru/stats.json";
import tr from "../../locales/tr/achievements.json";
import trStats from "../../locales/tr/stats.json";
import ar from "../../locales/ar/achievements.json";
import arStats from "../../locales/ar/stats.json";
import id from "../../locales/id/achievements.json";
import idStats from "../../locales/id/stats.json";
import it from "../../locales/it/achievements.json";
import itStats from "../../locales/it/stats.json";
import nl from "../../locales/nl/achievements.json";
import nlStats from "../../locales/nl/stats.json";
import pl from "../../locales/pl/achievements.json";
import plStats from "../../locales/pl/stats.json";
import vi from "../../locales/vi/achievements.json";
import viStats from "../../locales/vi/stats.json";
import type {YouTubeLocale} from "../../gameplay/local/types";

type AchievementCopy = Readonly<{NAME: string; DESCRIPTION: string}>;
type AchievementDictionary = Readonly<{Achievements: {
  SOLO: Readonly<Record<string, AchievementCopy>>;
  MILESTONES: Readonly<Record<string, AchievementCopy>>;
  UNLOCKED_LABEL: string;
}}>;
const copies: Readonly<Record<YouTubeLocale, AchievementDictionary>> = {en, es, pt, fr, de, ja, ko, hi, ru, tr, ar, id, it, nl, pl, vi};
const stats: Readonly<Record<YouTubeLocale, {StatsModal: Readonly<Record<string, string>>}>> = {
en: enStats, es: esStats, pt: ptStats, fr: frStats, de: deStats, ja: jaStats, ko: koStats, hi: hiStats, ru: ruStats, tr: trStats, ar: arStats, id: idStats, it: itStats, nl: nlStats, pl: plStats, vi: viStats};

/** Uses bundled translations without importing browser state or a provider SDK. */
export function achievementText(locale: YouTubeLocale, key: string, fallback = key): string {
  const [namespace, group, id, field] = key.split(".");
  if (namespace === "StatsModal") return stats[locale].StatsModal[group] ?? fallback;
  if (namespace !== "Achievements") return fallback;
  const dictionary = copies[locale].Achievements;
  if (group === "UNLOCKED_LABEL") return dictionary.UNLOCKED_LABEL;
  const entry = group === "SOLO" ? dictionary.SOLO[id] : group === "MILESTONES" ? dictionary.MILESTONES[id] : undefined;
  return field === "NAME" ? entry?.NAME ?? fallback : field === "DESCRIPTION" ? entry?.DESCRIPTION ?? fallback : fallback;
}
