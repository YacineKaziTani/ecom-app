import { test, expect } from "@playwright/test";
import { messages } from "../src/i18n/messages";

// The navbar search against the e2e fixtures (Tajine E2E, Robe E2E).
const en = messages.en;

test("suggestions as you type, even with a typo, open the product", async ({ page }) => {
  await page.goto("/shops");
  const box = page.getByRole("combobox", { name: en["search.label"] });
  await box.fill("tajin"); // missing letter
  await page.getByRole("option", { name: /Tajine E2E/ }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tajine E2E");
});

test("Enter searches the catalogue, keyboard picks a suggestion, and searches are remembered", async ({ page }) => {
  await page.goto("/shops");
  const box = page.getByRole("combobox", { name: en["search.label"] });
  await box.fill("ROBE");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/\?search=ROBE$/);
  await expect(page.getByRole("heading", { name: "Robe E2E" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tajine E2E" })).toHaveCount(0);

  // The last search is offered again when the box is opened empty.
  await page.goto("/shops");
  await box.click();
  await expect(page.getByRole("option", { name: "ROBE" })).toBeVisible();

  // ↓ ↓ Enter: past "Search for …" to the first product.
  await box.fill("tajine");
  await expect(page.getByRole("option", { name: /Tajine E2E/ })).toBeVisible();
  await box.press("ArrowDown");
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tajine E2E");
});

test("no results offers the closest product", async ({ page }) => {
  await page.goto("/?search=tagine%20e2e");
  await expect(page.getByText(en["home.emptyTitle"])).toBeVisible();
  await page.getByRole("button", { name: "Tajine E2E" }).click();
  await expect(page).toHaveURL(/search=Tajine/);
  await expect(page.getByRole("heading", { name: "Tajine E2E" })).toBeVisible();
});
