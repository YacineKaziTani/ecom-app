// Meta (Facebook) and TikTok advertising pixels. Their IDs are set in
// Dashboard → Store info; the scripts load only after the visitor accepts
// advertising cookies (ConsentBanner), and every call below does nothing
// until then.

type Consent = "granted" | "denied" | null;
const CONSENT_KEY = "ads-consent";
export const CONSENT_EVENT = "ads-consent-change";

export function adsConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

// null asks again (the footer's "Cookies" link).
export function setAdsConsent(value: Consent) {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Not stored: the banner will simply ask again next visit.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...args: unknown[]) => void };
type Ttq = { page: () => void; track: (event: string, data?: object) => void; load: (id: string) => void };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
  }
}

function addScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

// Meta's standard loader: a queueing stub, then fbevents.js.
function loadMeta(id: string) {
  if (window.fbq) return;
  const fbq: Fbq = (...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  };
  Object.assign(fbq, { queue: [], loaded: true, version: "2.0", push: fbq });
  window.fbq = window._fbq = fbq;
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", id);
}

// TikTok's standard loader (their snippet, typed): a stub queuing calls
// until events.js arrives.
function loadTikTok(id: string) {
  if (window.ttq) return;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  w.TiktokAnalyticsObject = "ttq";
  const ttq: any = (w.ttq = w.ttq || []);
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  ttq.setAndDefer = (target: any, method: string) => {
    target[method] = (...args: unknown[]) => target.push([method, ...args]);
  };
  for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
  ttq.instance = (name: string) => {
    const instance = ttq._i[name] || [];
    for (const method of ttq.methods) ttq.setAndDefer(instance, method);
    return instance;
  };
  ttq.load = (sdkId: string, options?: object) => {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[sdkId] = [];
    ttq._i[sdkId]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[sdkId] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[sdkId] = options || {};
    addScript(`${url}?sdkid=${encodeURIComponent(sdkId)}&lib=ttq`);
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  ttq.load(id);
}

// Events from pages that render before the pixels load (the order
// confirmation, a product page opened directly) wait here; dropped if the
// visitor refuses.
let pending: (() => void)[] = [];
const loaded = () => Boolean(window.fbq || window.ttq);
function run(event: () => void) {
  if (loaded()) event();
  else if (adsConsent() !== "denied" && pending.length < 20) pending.push(event);
}

export function loadPixels(ids: { facebook?: string | null; tiktok?: string | null }) {
  if (ids.facebook) loadMeta(ids.facebook);
  if (ids.tiktok) loadTikTok(ids.tiktok);
  const waiting = pending;
  pending = [];
  waiting.forEach((event) => event());
}

interface TrackedProduct {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}

const contents = (items: TrackedProduct[]) => ({
  meta: { content_ids: items.map((i) => i.id), content_type: "product", contents: items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1 })) },
  tiktok: { contents: items.map((i) => ({ content_id: i.id, content_name: i.name, price: i.price, quantity: i.quantity ?? 1 })), content_type: "product" },
});

export const pixels = {
  pageView() {
    window.fbq?.("track", "PageView");
    window.ttq?.page();
  },
  viewContent(product: TrackedProduct) {
    const c = contents([product]);
    run(() => {
      window.fbq?.("track", "ViewContent", { ...c.meta, content_name: product.name, value: product.price, currency: "DZD" });
      window.ttq?.track("ViewContent", { ...c.tiktok, value: product.price, currency: "DZD" });
    });
  },
  addToCart(product: TrackedProduct) {
    const value = product.price * (product.quantity ?? 1);
    const c = contents([product]);
    run(() => {
      window.fbq?.("track", "AddToCart", { ...c.meta, value, currency: "DZD" });
      window.ttq?.track("AddToCart", { ...c.tiktok, value, currency: "DZD" });
    });
  },
  initiateCheckout(items: TrackedProduct[], value: number) {
    const c = contents(items);
    run(() => {
      window.fbq?.("track", "InitiateCheckout", { ...c.meta, value, currency: "DZD", num_items: items.length });
      window.ttq?.track("InitiateCheckout", { ...c.tiktok, value, currency: "DZD" });
    });
  },
  // Once per order, even if the confirmation page is opened again.
  purchase(order: { id: string; total: number | string; items: { productId?: string | null; productName: string; price: number | string; quantity: number }[] }) {
    const items = order.items.map((i) => ({ id: i.productId ?? i.productName, name: i.productName, price: Number(i.price), quantity: i.quantity }));
    const c = contents(items);
    const value = Number(order.total);
    run(() => {
      const key = `pixel-purchase-${order.id}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        // Can't remember it: send anyway.
      }
      window.fbq?.("track", "Purchase", { ...c.meta, value, currency: "DZD" }, { eventID: order.id });
      window.ttq?.track("CompletePayment", { ...c.tiktok, value, currency: "DZD", order_id: order.id });
    });
  },
};
