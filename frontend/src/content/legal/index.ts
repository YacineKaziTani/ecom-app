import type { Lang } from "../../i18n/messages";
import type { LegalContent, LegalDoc, LegalDocument, LegalVars } from "./types";
import { en } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";

const CONTENT: Record<Lang, LegalContent> = { en, fr, ar };

export function legalDocument(lang: Lang, doc: LegalDoc, vars: LegalVars): LegalDocument {
  return CONTENT[lang](vars)[doc];
}

export type { LegalDoc, LegalDocument, LegalVars } from "./types";
export { MISSING } from "./types";
