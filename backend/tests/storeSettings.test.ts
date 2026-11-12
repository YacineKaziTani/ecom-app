import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { AuditLog } from "../src/entities/AuditLog";
import { settleBackgroundTasks } from "../src/utils/background";

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

    await settleBackgroundTasks();
    const logs = await AppDataSource.getRepository(AuditLog).find({ where: { action: "settings.update" }, order: { createdAt: "ASC" } });
    expect(logs).toHaveLength(3);
    expect(logs[1].details).toEqual({ fields: ["whatsapp", "facebookUrl"] });
  });

  it("rejects malformed details", async () => {
    const { agent } = await loginAs("super_admin");
    for (const body of [
      { phone: "12345" },
      { whatsapp: "0212345678" }, // a landline can't use WhatsApp
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

  it("gives link-preview crawlers a home page preview and lists the help pages in the sitemap", async () => {
    const home = await request(app).get("/api/seo/home");
    expect(home.status).toBe(200);
    expect(home.text).toMatch(/<meta property="og:image" content="http[^"]+\/og-image\.png"/);
    const sitemap = await request(app).get("/api/seo/sitemap.xml");
    for (const path of ["/contact", "/delivery-returns", "/terms", "/privacy"]) expect(sitemap.text).toContain(`${path}</loc>`);
  });
});
