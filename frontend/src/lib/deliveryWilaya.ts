// The wilaya a visitor last picked to see delivery prices (product page),
// reused as the checkout default. Per browser only.
const KEY = "delivery-wilaya";

export function savedWilaya(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isInteger(n) && n >= 1 && n <= 58 ? n : null;
  } catch {
    return null;
  }
}

export function saveWilaya(code: number | null) {
  try {
    if (code) localStorage.setItem(KEY, String(code));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode…): the choice just isn't remembered.
  }
}
