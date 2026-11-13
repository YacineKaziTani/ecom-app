import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages, Lang, MessageKey } from "./messages";
import { api } from "../api/client";
import { useBrand } from "../hooks/useBrand";
import { DEFAULT_BRAND } from "../lib/brand";

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "ar", label: "العربية", short: "عربي" },
  { code: "en", label: "English", short: "EN" },
];

const STORAGE_KEY = "lang";

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr" || stored === "ar") return stored;
  } catch {
    // storage unavailable
  }
  const browser = navigator.language?.slice(0, 2);
  return browser === "fr" || browser === "ar" ? browser : "en";
}

// The API answers (and writes emails) in the storefront's language. Set
// synchronously so even the very first requests carry it.
function tellApi(lang: Lang) {
  api.defaults.headers.common["Accept-Language"] = lang;
}

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  // Plural-aware: uses `${key}_one`, `${key}_two`, `${key}_few`… falling back to `${key}_other`.
  tp: (key: string, count: number, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

// {brand} is always the shop's name (texts like "Sell on {brand}").
function interpolate(text: string, vars: Vars) {
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = initialLang();
    tellApi(initial);
    return initial;
  });
  const dir = lang === "ar" ? "rtl" : "ltr";
  const { name: brand } = useBrand();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    tellApi(next);
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // in-memory choice still applies
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = messages[lang] as Record<string, string>;
    const fallback = messages.en as Record<string, string>;
    const rules = new Intl.PluralRules(lang);
    const lookup = (key: string) => dict[key] ?? fallback[key] ?? key;
    return {
      lang,
      dir,
      setLang,
      t: (key, vars) => interpolate(lookup(key), { brand, ...vars }),
      tp: (key, count, vars) => {
        const specific = `${key}_${rules.select(count)}`;
        const text = dict[specific] ?? dict[`${key}_other`] ?? fallback[`${key}_${new Intl.PluralRules("en").select(count)}`] ?? fallback[`${key}_other`] ?? key;
        return interpolate(text, { brand, count, ...vars });
      },
    };
  }, [lang, dir, setLang, brand]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// For components that may render outside the provider (the top-level error
// screen): falls back to English.
export function useOptionalI18n(): Pick<I18nValue, "t"> {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const en = messages.en as Record<string, string>;
  return { t: (key, vars) => interpolate(en[key] ?? key, { brand: DEFAULT_BRAND, ...vars }) };
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
