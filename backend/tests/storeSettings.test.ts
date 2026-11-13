import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { AuditLog } from "../src/entities/AuditLog";
import { settleBackgroundTasks } from "../src/utils/background";
import { backInStockEmail } from "../src/emails/stockEmails";
import { translator } from "../src/emails/i18n";
import { otpauthUrl } from "../src/utils/totp";
import { splitWordmark } from "../src/utils/brand";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

describe("store settings", () => {
  it("returns the defaults until a super admin saves them", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      legalName: null,
      phone: null,
      whatsapp: null,
      email: null,
      deliveryDaysMin: 2,
      deliveryDaysMax: 7,
      exchangeDays: 7,
      updatedAt: null,
    });
  });

  it("only lets a super admin change them", async () => {
    expect((await request(app).put("/api/settings").send({ legalName: "X" })).status).toBe(401);
    const { agent: shopAdmin } = await loginAs("admin");
    expect((await shopAdmin.put("/api/settings").send({ legalName: "X" })).status).toBe(403);
    const { agent: customer } = await loginAs("customer");
    expect((await customer.put("/api/settings").send({ legalName: "X" })).status).toBe(403);
  });

  it("saves the details, normalising phone numbers, and records who changed what", async () => {
    const { agent } = await loginAs("super_admin");
    const res = await agent.put("/api/settings").send({
      legalName: "  Atelier Benali SARL ",
      registerNumber: "16/00-1234567 B 21",
      phone: "021 12 34 56", // a landline
      whatsapp: "+213 550 12 34 56",
      email: "Contact@Example.com",
      facebookUrl: "https://facebook.com/atelier",
      exchangeDays: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      legalName: "Atelier Benali SARL",
      phone: "021123456",
      whatsapp: "213550123456",
      email: "contact@example.com",
      facebookUrl: "https://facebook.com/atelier",
      exchangeDays: 0,
      deliveryDaysMax: 7, // untouched
    });
    expect((await request(app).get("/api/settings")).body.legalName).toBe("Atelier Benali SARL");

    // A partial update keeps the rest; "" clears a field.
    const second = await agent.put("/api/settings").send({ whatsapp: "06 61 22 33 44", facebookUrl: "" });
    expect(second.body).toMatchObject({ whatsapp: "213661223344", facebookUrl: null, legalName: "Atelier Benali SARL" });
    // An international WhatsApp number is kept as-is.
    expect((await agent.put("/api/settings").send({ whatsapp: "+33 6 12 34 56 78" })).body.whatsapp).toBe("33612345678");
    // "+213" followed by the 0 people often keep.
    expect((await agent.put("/api/settings").send({ whatsapp: "+213 0550 12 34 56" })).body.whatsapp).toBe("213550123456");

    await settleBackgroundTasks();
    const logs = await AppDataSource.getRepository(AuditLog).find({ where: { action: "settings.update" }, order: { createdAt: "ASC" } });
    expect(logs).toHaveLength(4);
    expect(logs[1].details).toEqual({ fields: ["whatsapp", "facebookUrl"] });
  });

  it("rejects malformed details", async () => {
    const { agent } = await loginAs("super_admin");
    for (const body of [
      { phone: "12345" },
      { whatsapp: "0212345678" }, // a landline can't use WhatsApp
      { whatsapp: "+213 21 12 34 56" }, // nor a +213 landline
      { email: "not-an-email" },
      { facebookUrl: "http://facebook.com/x" }, // https only
      { facebookUrl: "javascript:alert(1)" },
      { exchangeDays: -1 },
      { deliveryDaysMin: 0 },
      { unknownField: "x" },
    ]) {
      const res = await agent.put("/api/settings").send(body);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    const swapped = await agent.put("/api/settings").send({ deliveryDaysMin: 10, deliveryDaysMax: 3 });
    expect(swapped.status).toBe(400);
    // Checked against the saved value too.
    expect((await agent.put("/api/settings").send({ deliveryDaysMin: 8 })).status).toBe(400);
    expect((await agent.put("/api/settings").send({ deliveryDaysMin: 3, deliveryDaysMax: 5 })).status).toBe(200);
  });

  it("lists the help pages in the sitemap", async () => {
    const sitemap = await request(app).get("/api/seo/sitemap.xml");
    for (const path of ["/contact", "/delivery-returns", "/terms", "/privacy"]) expect(sitemap.text).toContain(`${path}</loc>`);
  });

  it("renames the shop and sets its logo, everywhere the name appears", async () => {
    expect((await request(app).get("/api/settings")).body).toMatchObject({ brandName: "ArtisanShop", logoUrl: null });
    const { agent } = await loginAs("super_admin");
    expect((await agent.put("/api/settings").send({ brandName: "" })).status).toBe(400);
    expect((await agent.put("/api/settings").send({ brandName: "x".repeat(61) })).status).toBe(400);
    const logo = "https://res.cloudinary.com/demo/image/upload/v1/logo.png";
    const res = await agent.put("/api/settings").send({ brandName: "  Dar El Fen ", logoUrl: logo });
    expect(res.body).toMatchObject({ brandName: "Dar El Fen", logoUrl: logo });

    // Emails: the header, and texts that name the shop.
    const email = backInStockEmail("Bol", "https://shop.example/products/1", "fr");
    expect(email.html).toContain("Dar El <span");
    expect(email.html).toContain(">Fen</span>");
    expect(email.html).toContain(logo);
    expect(translator("fr")("sellerAdmin.body", { name: "Amina", shop: "Atelier" })).toBe("Amina souhaite ouvrir « Atelier » sur Dar El Fen.");
    expect(otpauthUrl("SECRET", "a@example.com")).toContain("issuer=Dar%20El%20Fen");

    // The installable app, named after the shop, with the logo as its icon.
    const manifest = await request(app).get("/api/seo/manifest.webmanifest");
    expect(manifest.type).toBe("application/manifest+json");
    const body = JSON.parse(manifest.text);
    expect(body).toMatchObject({ name: "Dar El Fen", short_name: "Dar El Fen", start_url: "/" });
    expect(body.icons[0].src).toBe("https://res.cloudinary.com/demo/image/upload/c_pad,b_white,w_192,h_192,f_png/v1/logo.png");

    expect((await agent.put("/api/settings").send({ logoUrl: "" })).body.logoUrl).toBeNull();
    expect(JSON.parse((await request(app).get("/api/seo/manifest.webmanifest")).text).icons[0].src).toBe("/icons/icon-192.png");
  });

  it("splits a shop name for its two-tone wordmark", () => {
    expect(splitWordmark("ArtisanShop")).toEqual(["Artisan", "Shop"]);
    expect(splitWordmark("Dar El Fen")).toEqual(["Dar El ", "Fen"]);
    expect(splitWordmark("tajine")).toEqual(["tajine", ""]);
    expect(splitWordmark("دار الفن")).toEqual(["دار ", "الفن"]);
  });
});
