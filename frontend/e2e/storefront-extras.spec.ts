import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { messages } from "../src/i18n/messages";

// Promotions, free delivery, back-in-stock alerts, advertising consent, home
// banners and the shop's brand, against the end-to-end fixtures. Every
// setting changed here is put back at the end.
const m = messages.en;
const WEB = `http://localhost:${process.env.E2E_WEB_PORT ?? 5180}`;

async function signedIn(browser: Browser, email: string): Promise<APIRequestContext> {
  const ctx = await browser.newContext();
  expect((await ctx.request.post(`${WEB}/api/auth/login`, { data: { email, password: "Password123" } })).ok()).toBeTruthy();
  return ctx.request;
}

test("promotions, free delivery, back-in-stock, consent, banners and the brand", async ({ browser, page }) => {
  const admin = await signedIn(browser, "admin-e2e@example.com");
  const owner = await signedIn(browser, "owner-e2e@example.com");
  const settings = (data: object) => admin.put(`${WEB}/api/settings`, { data });

  // A promotion: crossed-out price, −x% badge, and the "On sale" filter.
  const created = await owner.post(`${WEB}/api/products`, { data: { name: "Plateau Promo E2E", price: 4000, compareAtPrice: 5000, stock: 4 } });
  expect(created.ok()).toBeTruthy();
  const promo = await created.json();
  await page.goto(`/products/${promo.id}`);
  await expect(page.getByText("−20%").first()).toBeVisible();
  // Amounts use non-breaking spaces ("1 000 DA").
  await expect(page.getByText(/You save 1\s000\sDA/)).toBeVisible();
  await page.goto("/?promo=1");
  await expect(page.getByText("Plateau Promo E2E").first()).toBeVisible();
  await expect(page.getByText("Tajine E2E")).toHaveCount(0);

  // Free delivery from 3 000 DA: the cart shows it, and so does the order.
  expect((await settings({ freeShippingThreshold: 3000 })).ok()).toBeTruthy();
  await page.goto(`/products/${promo.id}`);
  await page.getByRole("button", { name: m["product.addToCart"], exact: true }).click();
  await page.goto("/cart");
  await expect(page.getByText(m["cart.freeDeliveryReached"])).toBeVisible();
  await page.getByLabel(m["cart.wilaya"], { exact: true }).selectOption("16");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

  // Sold out: the buy button gives way to "tell me when it's back".
  const soldOut = await (await owner.post(`${WEB}/api/products`, { data: { name: "Vase Épuisé E2E", price: 2000, stock: 0 } })).json();
  await page.goto(`/products/${soldOut.id}`);
  await expect(page.getByRole("button", { name: m["product.addToCart"], exact: true })).toHaveCount(0);
  await page.getByPlaceholder("you@example.com").fill("waiting-e2e@example.com");
  await page.getByRole("button", { name: m["stockAlert.submit"] }).click();
  await expect(page.getByText(m["stockAlert.done"].replace("{email}", "waiting-e2e@example.com"))).toBeVisible();

  // Advertising pixels load only after the visitor accepts.
  expect((await settings({ facebookPixelId: "123456789012345" })).ok()).toBeTruthy();
  await page.evaluate(() => localStorage.setItem("ads-consent", "denied")); // this tab: no banner in the way
  for (const accept of [false, true]) {
    const ctx = await browser.newContext();
    const visitor = await ctx.newPage();
    await visitor.addInitScript(() => localStorage.setItem("lang", "en"));
    await visitor.route("https://connect.facebook.net/**", (route) => route.abort());
    await visitor.goto(`${WEB}/`);
    const banner = visitor.getByRole("dialog", { name: m["consent.title"] });
    await expect(banner).toBeVisible();
    expect(await visitor.evaluate(() => typeof (window as { fbq?: unknown }).fbq)).toBe("undefined");
    await banner.getByRole("button", { name: accept ? m["consent.accept"] : m["consent.refuse"] }).click();
    await expect(banner).toHaveCount(0);
    expect(await visitor.evaluate(() => typeof (window as { fbq?: unknown }).fbq)).toBe(accept ? "function" : "undefined");
    await ctx.close();
  }
  // The privacy policy now says so.
  await page.goto("/privacy");
  await expect(page.getByText(/advertising cookies from Meta \(Facebook\)/)).toBeVisible();

  // A home page banner, shown with its button.
  const banner = await (
    await admin.post(`${WEB}/api/home/banners`, {
      data: { imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg", title: "Soldes d'automne E2E", ctaLabel: "Voir les boutiques", link: "/shops" },
    })
  ).json();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Soldes d'automne E2E" })).toBeVisible();
  await page.getByRole("link", { name: "Voir les boutiques" }).click();
  await expect(page).toHaveURL(/\/shops$/);

  // Renaming the shop renames it everywhere.
  expect((await settings({ brandName: "Dar Fen" })).ok()).toBeTruthy();
  await page.goto(`/products/${promo.id}`);
  await expect(page.locator("header").getByText("Dar Fen")).toBeVisible();
  await expect(page).toHaveTitle("Plateau Promo E2E — Dar Fen");
  await expect(page.locator("footer").getByText(`© ${new Date().getFullYear()} Dar Fen. All rights reserved.`)).toBeVisible();

  // Put everything back for the other tests.
  await admin.delete(`${WEB}/api/home/banners/${banner.id}`);
  expect((await settings({ brandName: "ArtisanShop", facebookPixelId: "", freeShippingThreshold: null })).ok()).toBeTruthy();
});
