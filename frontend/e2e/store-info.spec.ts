import { test, expect } from "@playwright/test";
import { messages } from "../src/i18n/messages";

// Dashboard → Store info feeds the Contact page, the WhatsApp button and the
// legal pages. The end-to-end seed starts with nothing filled in.
const m = messages.en;
const API = `http://localhost:${process.env.E2E_API_PORT ?? 4100}/api`;

test("a super admin fills in the store details, and customers see them", async ({ page, request }) => {
  // Before: the legal pages mark what's missing, and there's no WhatsApp button.
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of sale");
  await expect(page.getByText(m["legal.missing"]).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m["whatsapp.button"] })).toHaveCount(0);
  await page.goto("/contact");
  await expect(page.getByText(m["contact.soon"])).toBeVisible();

  const login = await page.request.post("/api/auth/login", { data: { email: "admin-e2e@example.com", password: "Password123" } });
  expect(login.ok()).toBeTruthy();
  await page.goto("/dashboard/store-info");
  await expect(page.getByText(m["dash.store.missing"])).toBeVisible();

  await page.getByLabel(m["dash.store.legalName"]).fill("Atelier E2E SARL");
  await page.getByLabel(m["dash.store.registerNumber"]).fill("16/00-0000000 B 24");
  await page.getByLabel(m["dash.store.taxId"]).fill("000016000000000");
  await page.getByLabel(m["dash.store.address"]).fill("12 Rue Didouche Mourad, Alger");
  await page.getByLabel(m["dash.store.phone"], { exact: true }).fill("021 12 34 56");
  await page.getByLabel(m["dash.store.email"]).fill("contact@atelier-e2e.dz");
  await page.getByLabel(m["dash.store.exchangeDays"]).fill("0");

  // A landline can't be a WhatsApp number: the field says why.
  await page.getByLabel(m["dash.store.whatsapp"]).fill("021 12 34 56");
  await page.getByRole("button", { name: m["common.save"], exact: true }).click();
  await expect(page.getByText(m["dash.store.err.whatsapp"])).toBeVisible();

  await page.getByLabel(m["dash.store.whatsapp"]).fill("+213 550 12 34 56");
  await page.getByRole("button", { name: m["common.save"], exact: true }).click();
  await expect(page.getByText(m["dash.store.saved"])).toBeVisible();
  await expect(page.getByText(m["dash.store.complete"])).toBeVisible();
  // Saved in the normalised form, shown back formatted.
  await expect(page.getByLabel(m["dash.store.whatsapp"])).toHaveValue("0550 12 34 56");
  const saved = await (await request.get(`${API}/settings`)).json();
  expect(saved).toMatchObject({ whatsapp: "213550123456", phone: "021123456", exchangeDays: 0 });

  // The Contact page.
  await page.goto("/contact");
  await expect(page.getByRole("link", { name: m["contact.whatsappCta"] })).toHaveAttribute("href", /^https:\/\/wa\.me\/213550123456\?text=/);
  await expect(page.getByRole("link", { name: m["contact.call"] })).toHaveAttribute("href", "tel:021123456");
  await expect(page.getByText("Atelier E2E SARL")).toBeVisible();

  // The legal pages, complete now.
  await page.goto("/terms");
  await expect(page.getByText("Atelier E2E SARL", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(m["legal.missing"])).toHaveCount(0);
  await page.goto("/delivery-returns");
  await expect(page.getByText(/We don't exchange items that match your order/)).toBeVisible();

  // The floating button, whose message points at the product being looked at.
  const products = await (await request.get(`${API}/products`, { params: { search: "Tajine E2E" } })).json();
  const productPath = `/products/${products.items[0].id}`;
  await page.goto(productPath);
  const button = page.getByRole("link", { name: m["whatsapp.button"] });
  await expect(button).toBeVisible();
  const href = decodeURIComponent((await button.getAttribute("href"))!);
  expect(href).toContain("https://wa.me/213550123456?text=");
  expect(href).toContain(productPath);
});
