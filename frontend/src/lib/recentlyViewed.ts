// Product ids the visitor opened, newest first (this browser only).
const KEY = "recently-viewed";
const MAX = 12;

export function recentlyViewed(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberViewed(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...recentlyViewed().filter((x) => x !== id)].slice(0, MAX)));
  } catch {
    // Storage full or blocked (private mode): the list is a nicety, skip it.
  }
}
