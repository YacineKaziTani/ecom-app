// The Terms of sale, Privacy policy and Delivery and returns pages, written
// once per language. Store details come from Dashboard → Store info; any
// still empty arrive as MISSING and are shown as "[to be completed]".
//
// In the texts, [label](/path) is a link and **text** is bold.

export type LegalDoc = "terms" | "privacy" | "delivery";

export type Block = string | { list: string[] };

export interface LegalSection {
  heading: string;
  body: Block[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalVars {
  site: string;
  legalName: string;
  registerNumber: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  deliveryMin: number;
  deliveryMax: number;
  exchangeDays: number; // 0 = no exchanges for a change of mind
  adPixels: string[]; // advertising pixels in use, e.g. ["Meta (Facebook)", "TikTok"]
}

export type LegalContent = (v: LegalVars) => Record<LegalDoc, LegalDocument>;

export const MISSING = "⟪missing⟫";
