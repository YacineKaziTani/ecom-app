import { COMMUNES } from "../data/communes";

export interface Commune {
  name: string; // the official Latin spelling — what orders and addresses store
  nameAr: string;
}

// "Bab-Ezzouar", "bab ezzouar", "BAB EZZOUAR" and "باب الزوار" all find the
// same commune: case, accents, hyphens/apostrophes, extra spaces and Arabic
// letter variants (أ/إ/آ → ا, ة → ه, ى → ي, short vowels) don't matter.
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ْـ]/g, "") // Arabic short vowels and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/[-'’_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byWilaya = new Map<number, Commune[]>();
const lookup = new Map<string, Commune>(); // `${wilaya}:${normalized name}`
for (const [wilayaCode, name, nameAr] of COMMUNES) {
  const commune = { name, nameAr };
  const list = byWilaya.get(wilayaCode) ?? [];
  list.push(commune);
  byWilaya.set(wilayaCode, list);
  lookup.set(`${wilayaCode}:${normalizeName(name)}`, commune);
  lookup.set(`${wilayaCode}:${normalizeName(nameAr)}`, commune);
}

// The wilaya's communes, alphabetical by Latin name.
export function communesOf(wilayaCode: number): Commune[] {
  return byWilaya.get(wilayaCode) ?? [];
}

// The commune of that wilaya matching `input` (Latin or Arabic name), or null.
export function findCommune(wilayaCode: number, input: string | null | undefined): Commune | null {
  if (!input) return null;
  return lookup.get(`${wilayaCode}:${normalizeName(input)}`) ?? null;
}
