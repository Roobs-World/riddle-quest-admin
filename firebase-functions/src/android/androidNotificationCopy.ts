/** Daily reminder copy for every supported game locale. */
const COPY: Readonly<Record<string, string>> = {
  en: "Today's Daily Challenge is ready.",
  fr: "Le défi quotidien du jour est prêt.",
  ja: "今日のデイリーチャレンジが始まりました。",
  de: "Die tägliche Herausforderung ist bereit.",
  pl: "Dzisiejsze wyzwanie dnia jest gotowe.",
  ko: "오늘의 일일 도전이 준비되었습니다.",
  nl: "De dagelijkse uitdaging staat klaar.",
  tr: "Bugünün günlük meydan okuması hazır.",
  pt: "O desafio diário de hoje está pronto.",
  vi: "Thử thách hằng ngày hôm nay đã sẵn sàng.",
  id: "Tantangan harian hari ini sudah siap.",
  es: "El desafío diario de hoy está listo.",
  ru: "Ежедневное испытание на сегодня готово.",
  it: "La sfida quotidiana di oggi è pronta.",
  hi: "आज की दैनिक चुनौती तैयार है।",
  ar: "التحدي اليومي جاهز الآن.",
};
/** Uses the recipient-selected locale with an English fallback. */
export const androidDailyReminderCopy = (locale: unknown): string =>
  typeof locale === "string" ? (COPY[locale] ?? COPY.en) : COPY.en;
