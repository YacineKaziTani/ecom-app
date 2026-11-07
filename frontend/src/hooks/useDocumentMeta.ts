import { useEffect } from "react";

const SITE = "ArtisanShop";
const DEFAULT_TITLE = "ArtisanShop — Curated goods from independent makers";
const DEFAULT_DESCRIPTION =
  "ArtisanShop — a curated marketplace of premium goods from independent makers.";

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

// Per-page <title>, meta description and (optionally) JSON-LD structured data
// for search engines. Restores the defaults when the page unmounts.
export function useDocumentMeta(
  title: string | undefined,
  description?: string,
  structuredData?: object,
) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} — ${SITE}`;
    setMeta("description", (description || DEFAULT_DESCRIPTION).slice(0, 300));

    let script: HTMLScriptElement | null = null;
    if (structuredData) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESCRIPTION);
      script?.remove();
    };
  }, [title, description, JSON.stringify(structuredData)]);
}
