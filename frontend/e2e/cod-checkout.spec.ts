import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { messages } from "../src/i18n/messages";

// Pay-on-delivery checkout through the real UI, against the fixtures from
// backend/src/seed/e2eFixtures.ts (wilaya 16 home delivery: 400 DA).
const API = `http://localhost:${process.env.E2E_API_PORT ?? 4100}/api`;

interface ProductSummary {
  id: string;
  stock: number;
}

async function findProduct(request: APIRequestContext, name: string): Promise<ProductSummary> {
  const res = await request.get(`${API}/products`, { params: { search: name } });
  expect(res.ok()).toBeTruthy();
  const { items } = await res.json();
  expect(items).toHaveLength(1);
  return items[0];
}

async function trackOrder(request: APIRequestContext, id: string, email: string) {
  const res = await request.get(`${API}/orders/track/${id}`, { params: { email } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function fillDelivery(page: Page, m: Record<string, string>, email: string) {
  await page.getByLabel(m["cart.fullName"], { exact: true }).fill("Amina Benali");
  await page.getByLabel(m["cart.email"], { exact: true }).fill(email);
  await page.getByLabel(m["cart.phone"], { exact: true }).fill("0550 12 34 56");
  await page.getByLabel(m["cart.wilaya"], { exact: true }).selectOption("16");
  // A dropdown of the wilaya's communes; the value is the official Latin name.
  await page.getByLabel(m["cart.commune"], { exact: true }).selectOption("Alger Centre");
  await page.getByLabel(m["cart.address"], { exact: true }).fill("12 Rue Didouche Mourad");
}

const orderIdFrom = (page: Page) => page.url().match(/order-confirmation\/([0-9a-f-]{36})/)![1];

test("a guest orders a product and a size option, pays on delivery, then cancels", async ({ page, request }) => {
  const en = messages.en;
  const email = uniqueEmail();
  const tajine = await findProduct(request, "Tajine E2E");
  const robe = await findProduct(request, "Robe E2E");

  await page.goto(`/products/${tajine.id}`);
  await page.getByRole("button", { name: en["product.addToCart"], exact: true }).click();

  // A product with options can't be added until one is chosen.
  await page.goto(`/products/${robe.id}`);
  await expect(page.getByRole("button", { name: en["product.chooseOption"], exact: true })).toBeDisabled();
  await page
    .getByRole("group", { name: en["product.chooseOption"] })
    .getByRole("button")
    .filter({ hasText: /^M/ })
    .click();
  await page.getByRole("button", { name: en["product.addToCart"], exact: true }).click();

  await page.goto("/cart");
  await expect(page.getByText("Option: M")).toBeVisible();
  await fillDelivery(page, en, email);
  await page.getByRole("button", { name: en["cart.placeOrder"] }).click();

  await expect(page).toHaveURL(/\/order-confirmation\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en["order.placedTitle"]);

  const order = await trackOrder(request, orderIdFrom(page), email);
  expect(order).toMatchObject({ paymentMethod: "cod", status: "pending", locale: "en" });
  expect(order.items.map((i: { productName: string; variantName: string | null }) => [i.productName, i.variantName]).sort()).toEqual([
    ["Robe E2E", "M"],
    ["Tajine E2E", null],
  ]);
  expect(Number(order.total)).toBe(3500 + 6500 + 400); // M costs more; home delivery to Alger
  expect((await findProduct(request, "Tajine E2E")).stock).toBe(tajine.stock - 1);

  // Changed their mind before it shipped: cancel from the confirmation page.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: en["order.cancel"] }).click();
  await expect(page.getByText(en["order.cancelledByYou"])).toBeVisible();
  expect((await trackOrder(request, order.id, email)).status).toBe("cancelled");
  expect((await findProduct(request, "Tajine E2E")).stock).toBe(tajine.stock);
});

test("the storefront works in Arabic, right to left, and the order keeps the language", async ({ page, request }) => {
  const ar = messages.ar;
  const email = uniqueEmail();
  await page.addInitScript(() => localStorage.setItem("lang", "ar"));
  const tajine = await findProduct(request, "Tajine E2E");

  await page.goto(`/products/${tajine.id}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: ar["product.addToCart"], exact: true }).click();

  await page.goto("/cart");
  await fillDelivery(page, ar, email);
  await page.getByRole("button", { name: ar["cart.placeOrder"] }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ar["order.placedTitle"]);
  const order = await trackOrder(request, orderIdFrom(page), email);
  expect(order).toMatchObject({ paymentMethod: "cod", locale: "ar" }); // its emails go out in Arabic
});
