import { test, expect, type Page } from "@playwright/test";
import { messages } from "../src/i18n/messages";

// Opens every page, as each kind of user, in French and Arabic, and fails on
// a crash, the error screen, or an untranslated key showing up on screen
// (t() falls back to the key itself, e.g. "dash.orders.title").
const PASSWORD = "Password123"; // backend/src/seed/e2eFixtures.ts
const ACCOUNTS = {
  customer: "customer-e2e@example.com",
  shopAdmin: "owner-e2e@example.com",
  superAdmin: "admin-e2e@example.com",
};

const PUBLIC_PAGES = ["/", "/shops", "/shops/atelier-e2e", "/cart", "/track-order", "/sell", "/contact", "/delivery-returns", "/terms", "/privacy", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/no-such-page"];
const CUSTOMER_PAGES = ["/orders", "/profile", "/wishlist", "/sell"];
const SHOP_ADMIN_PAGES = ["/dashboard", "/dashboard/analytics", "/dashboard/my-shop", "/dashboard/products", "/dashboard/orders", "/dashboard/coupons", "/dashboard/payouts", "/dashboard/profile"];
const SUPER_ADMIN_PAGES = [
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/products",
  "/dashboard/categories",
  "/dashboard/orders",
  "/dashboard/coupons",
  "/dashboard/payouts",
  "/dashboard/users",
  "/dashboard/shipping",
  "/dashboard/store-info",
  "/dashboard/home-page",
  "/dashboard/applications",
  "/dashboard/blocked-numbers",
  "/dashboard/activity",
  "/dashboard/profile",
];

const KEY_ON_SCREEN = /\b(?:common|nav|home|sort|product|cart|order|orders|status|dash|profile|addresses|role|shops?|shopPage|sell|forgot|reset|verify|notFound|stars|error|gallery|session|upload|twofa|search|footer|contact|legal|whatsapp|auth|stockAlert|consent)\.[a-z][A-Za-z_.]*\b/;

async function signIn(page: Page, email: string) {
  // Through the dev server's /api proxy, so the session cookies are the page's.
  const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
}

async function visitAll(page: Page, lang: "fr" | "ar", paths: string[]) {
  const crashes: string[] = [];
  page.on("pageerror", (err) => crashes.push(`${page.url()}: ${err.message}`));
  const errorTitle = messages[lang]["error.title"];

  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html"), path).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expect(page.getByText(errorTitle), path).toHaveCount(0);
    const text = await page.locator("body").innerText();
    expect(text.match(KEY_ON_SCREEN)?.[0], `untranslated key on ${path}`).toBeUndefined();
  }
  expect(crashes).toEqual([]);
}

for (const lang of ["fr", "ar"] as const) {
  test.describe(`every page in ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem("lang", l), lang);
    });

    test("public pages", async ({ page, request }) => {
      const res = await request.get(`http://localhost:${process.env.E2E_API_PORT ?? 4100}/api/products`, {
        params: { search: "Robe E2E" },
      });
      const robe = (await res.json()).items[0];
      await visitAll(page, lang, [...PUBLIC_PAGES, `/products/${robe.id}`]);
    });

    test("public pages fit a phone screen, without sideways scrolling", async ({ page, request }) => {
      const res = await request.get(`http://localhost:${process.env.E2E_API_PORT ?? 4100}/api/products`, {
        params: { search: "Tajine E2E" },
      });
      const tajine = (await res.json()).items[0];
      await page.setViewportSize({ width: 360, height: 800 });
      const tooWide: string[] = [];
      for (const path of [...PUBLIC_PAGES, `/products/${tajine.id}`]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        if (scrollWidth > innerWidth) tooWide.push(`${path}: ${scrollWidth}px`);
      }
      expect(tooWide).toEqual([]);
    });

    test("customer pages", async ({ page }) => {
      await signIn(page, ACCOUNTS.customer);
      await visitAll(page, lang, CUSTOMER_PAGES);
    });

    test("shop admin dashboard", async ({ page }) => {
      await signIn(page, ACCOUNTS.shopAdmin);
      await visitAll(page, lang, SHOP_ADMIN_PAGES);
    });

    test("super admin dashboard", async ({ page }) => {
      await signIn(page, ACCOUNTS.superAdmin);
      await visitAll(page, lang, SUPER_ADMIN_PAGES);
    });
  });
}
