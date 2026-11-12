// The visitor's last searches, newest first (this browser only).
const KEY = "recent-searches";
const MAX = 6;

export function recentSearches(): string[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(items) ? items.filter((q) => typeof q === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  try {
    const rest = recentSearches().filter((item) => item.toLowerCase() !== q.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([q, ...rest].slice(0, MAX)));
  } catch {
    // Storage unavailable: nothing to remember.
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable.
  }
}
