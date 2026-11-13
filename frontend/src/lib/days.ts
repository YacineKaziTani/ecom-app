import type { Lang } from "../i18n/messages";

// "2 to 7 days" / "2 à 7 jours" / "من 2 إلى 7 أيام", with each language's
// counted-noun rules (Arabic: يوم واحد، يومين، 3–10 أيام، 11+ يوماً).
export function dayRange(lang: Lang, min: number, max: number): string {
  const days = (n: number) => {
    if (lang === "ar") return n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`;
    if (lang === "fr") return n === 1 ? "1 jour" : `${n} jours`;
    return n === 1 ? "1 day" : `${n} days`;
  };
  if (min >= max) return days(max);
  if (lang === "ar") return `من ${min} إلى ${days(max)}`;
  return lang === "fr" ? `${min} à ${days(max)}` : `${min} to ${days(max)}`;
}
