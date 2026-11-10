import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, createUser, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import { Product } from "../src/entities/Product";
import { User } from "../src/entities/User";
import { Shipment } from "../src/entities/Shipment";
import * as mailer from "../src/services/email";
import { settleBackgroundTasks } from "../src/utils/background";
import { localeFromHeader } from "../src/emails/i18n";
import { renderPasswordResetEmail } from "../src/emails/passwordReset";

beforeAll(initTestDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const stockOf = async (id: string) => (await AppDataSource.getRepository(Product).findOneByOrFail({ id })).stock;
const sent = (send: jest.SpyInstance, template: string) => send.mock.calls.filter(([t]) => t === template);

async function shopWithProduct(ownerLocale: "en" | "fr" | "ar" = "en") {
  const { agent, user } = await loginAs("admin", { locale: ownerLocale });
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, { name: "Tapis", price: 2000, stock: 10 });
  return { agent, owner: user, shop, product };
}

function order(
  agent: ReturnType<typeof request> | ReturnType<typeof request.agent>,
  productId: string,
  extra: Record<string, unknown> = {},
  language?: string,
) {
  const req = agent.post("/api/orders");
  if (language) req.set("Accept-Language", language);
  return req.send({
    ...DELIVERY,
    shippingAddress: "5 Rue des Frères Bouadou, Alger",
    paymentMethod: "cod",
    items: [{ productId, quantity: 2 }],
    ...extra,
  });
}
const guestOrder = (productId: string, email: string, language?: string) =>
  order(request(app), productId, { guestEmail: email }, language);

describe("emails in the customer's language", () => {
  it("reads the language from Accept-Language", () => {
    expect(localeFromHeader("fr-DZ,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(localeFromHeader("ar")).toBe("ar");
    expect(localeFromHeader("de-DE,en;q=0.5")).toBe("en");
    expect(localeFromHeader("de")).toBeNull();
    expect(localeFromHeader(undefined)).toBeNull();
  });

  it("stores the order's language and writes the customer's emails in it", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { product } = await shopWithProduct("fr");
    const res = await guestOrder(product.id, "amina@example.com", "ar-DZ,ar;q=0.9");
    expect(res.status).toBe(201);
    expect(res.body.locale).toBe("ar");
    await settleBackgroundTasks();

    const [[, to, placed]] = sent(send, "order-placed");
    expect(to).toBe("amina@example.com");
    expect(placed.subject).toMatch(/^تم استلام الطلب/);
    expect(placed.html).toContain('dir="rtl"');
    expect(placed.text).toContain("نقدًا عند الاستلام");

    // The shop owner reads theirs in their own language.
    const [[, , shopMail]] = sent(send, "shop-new-order");
    expect(shopMail.subject).toMatch(/^Nouvelle commande/);
    expect(shopMail.html).toContain('dir="ltr"');
  });

  it("defaults to English when the language isn't one we speak", async () => {
    const { product } = await shopWithProduct();
    const res = await guestOrder(product.id, "x@example.com", "de-DE");
    expect(res.body.locale).toBe("en");
  });

  it("status emails follow the order's language", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent, product } = await shopWithProduct();
    const placed = await guestOrder(product.id, "k@example.com", "fr");
    await settleBackgroundTasks();
    send.mockClear();

    await agent.patch(`/api/orders/${placed.body.id}/status`).send({ status: "shipped" }).expect(200);
    await settleBackgroundTasks();
    const [[, , status]] = sent(send, "order-status");
    expect(status.subject).toMatch(/^Votre commande est en route/);
  });

  it("remembers a user's language at sign-up, sign-in and from the profile", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const reg = await request(app)
      .post("/api/auth/register")
      .set("Accept-Language", "fr-FR")
      .send({ email: "nadia@example.com", password: "Password123", firstName: "Nadia", lastName: "B" });
    expect(reg.status).toBe(201);
    await settleBackgroundTasks();
    const users = AppDataSource.getRepository(User);
    expect((await users.findOneByOrFail({ email: "nadia@example.com" })).locale).toBe("fr");
    expect(sent(send, "verify-email")[0][2].subject).toBe("Confirmez votre adresse e-mail");

    const agent = request.agent(app);
    await agent.post("/api/auth/login").set("Accept-Language", "ar").send({ email: "nadia@example.com", password: "Password123" }).expect(200);
    expect((await users.findOneByOrFail({ email: "nadia@example.com" })).locale).toBe("ar");

    await agent.patch("/api/auth/me").send({ locale: "en" }).expect(200);
    expect((await users.findOneByOrFail({ email: "nadia@example.com" })).locale).toBe("en");
    expect((await agent.patch("/api/auth/me").send({ locale: "de" })).status).toBe(400);
  });

  it("sends the password reset email in the language it was asked from", async () => {
    const reset = jest.spyOn(mailer, "sendPasswordResetEmail").mockResolvedValue(true);
    const { user } = await createUser({ email: "reset-me@example.com", locale: "fr" });
    await request(app).post("/api/auth/forgot-password").set("Accept-Language", "ar").send({ email: user.email }).expect(200);
    expect(reset).toHaveBeenCalledWith(user.email, expect.objectContaining({ locale: "ar" }));
    // Without a language on the request, the account's own is used.
    await request(app).post("/api/auth/forgot-password").send({ email: user.email }).expect(200);
    expect(reset).toHaveBeenLastCalledWith(user.email, expect.objectContaining({ locale: "fr" }));

    const email = renderPasswordResetEmail({ name: "Nadia", resetLink: "https://x.test/r", expiresInMinutes: 30, locale: "ar" });
    expect(email.subject).toBe("إعادة تعيين كلمة المرور");
    expect(email.html).toContain('dir="rtl"');
  });
});

describe("customers cancelling their own order", () => {
  it("cancels before shipping, restocks and tells the shop", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id);
    expect(await stockOf(product.id)).toBe(8);
    await settleBackgroundTasks();
    send.mockClear();

    const res = await agent.post(`/api/orders/${placed.body.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "cancelled", cancelledBy: "customer" });
    expect(await stockOf(product.id)).toBe(10);

    await settleBackgroundTasks();
    expect(sent(send, "order-status")[0][2].text).toContain("You cancelled this order");
    expect(sent(send, "shop-order-cancelled")).toHaveLength(1);

    // Doing it twice changes nothing.
    await agent.post(`/api/orders/${placed.body.id}/cancel`).expect(200);
    expect(await stockOf(product.id)).toBe(10);
  });

  it("lets a guest cancel with the email used at checkout", async () => {
    const { product } = await shopWithProduct();
    const placed = await guestOrder(product.id, "Guest@Example.com");
    expect((await request(app).post(`/api/orders/${placed.body.id}/cancel`).send({ email: "other@example.com" })).status).toBe(404);
    expect((await request(app).post(`/api/orders/${placed.body.id}/cancel`)).status).toBe(404);
    const res = await request(app).post(`/api/orders/${placed.body.id}/cancel`).send({ email: "guest@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("only the customer who placed it can cancel it", async () => {
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id);
    const { agent: stranger } = await loginAs("customer");
    expect((await stranger.post(`/api/orders/${placed.body.id}/cancel`)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${placed.body.id}/cancel`)).status).toBe(404);
  });

  it("refuses once a shop has shipped its part", async () => {
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id);
    await AppDataSource.getRepository(Shipment).update({ orderId: placed.body.id }, { status: "shipped" });
    const res = await agent.post(`/api/orders/${placed.body.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANCEL_TOO_LATE");
  });

  it("sends paid card orders to the shop team for a refund", async () => {
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id, { paymentMethod: "card" });
    await orders().update(placed.body.id, { paymentStatus: "paid", status: "processing" });
    const res = await agent.post(`/api/orders/${placed.body.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANCEL_NEEDS_REFUND");
  });

  it("an unpaid card order can be cancelled", async () => {
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id, { paymentMethod: "card" });
    expect((await agent.post(`/api/orders/${placed.body.id}/cancel`)).status).toBe(200);
  });

  it("reactivating a customer-cancelled order clears who cancelled it", async () => {
    const { product } = await shopWithProduct();
    const { agent } = await loginAs("customer");
    const placed = await order(agent, product.id);
    await agent.post(`/api/orders/${placed.body.id}/cancel`).expect(200);
    const { agent: admin } = await loginAs("super_admin");
    await admin.patch(`/api/orders/${placed.body.id}/status`).send({ status: "pending" }).expect(200);
    expect((await orders().findOneByOrFail({ id: placed.body.id })).cancelledBy).toBeNull();
  });
});

describe("address book", () => {
  const home = { label: "Maison", phone: "0550 11 22 33", wilayaCode: 16, commune: "Hydra", address: "12 Rue Ahmed Ouaked" };
  const work = { label: "Travail", phone: "0661 44 55 66", wilayaCode: 31, commune: "Bir El Djir", address: "Cité USTO, bloc 4" };

  it("saves addresses; the first one is the default", async () => {
    const { agent } = await loginAs("customer");
    const a = await agent.post("/api/addresses").send(home);
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ label: "Maison", phone: "0550112233", isDefault: true });
    const b = await agent.post("/api/addresses").send(work);
    expect(b.body.isDefault).toBe(false);

    const list = await agent.get("/api/addresses");
    expect(list.body.map((x: { label: string }) => x.label)).toEqual(["Maison", "Travail"]);
  });

  it("switching the default moves it, and deleting it promotes another", async () => {
    const { agent } = await loginAs("customer");
    const a = await agent.post("/api/addresses").send(home);
    const b = await agent.post("/api/addresses").send(work);

    await agent.put(`/api/addresses/${b.body.id}`).send({ isDefault: true, commune: "Es Senia" }).expect(200);
    let list = (await agent.get("/api/addresses")).body;
    expect(list.map((x: { label: string; isDefault: boolean }) => [x.label, x.isDefault])).toEqual([
      ["Travail", true],
      ["Maison", false],
    ]);
    expect(list[0].commune).toBe("Es Senia");

    await agent.delete(`/api/addresses/${b.body.id}`).expect(204);
    list = (await agent.get("/api/addresses")).body;
    expect(list).toEqual([expect.objectContaining({ id: a.body.id, isDefault: true })]);
  });

  it("turns the address saved on an older profile into the first saved address", async () => {
    const { agent } = await loginAs("customer", {
      phone: "0770 99 88 77",
      wilayaCode: 9,
      commune: "Blida",
      address: "Rue des Orangers",
    });
    const res = await agent.get("/api/addresses").set("Accept-Language", "fr");
    expect(res.body).toEqual([
      expect.objectContaining({ label: "Domicile", phone: "0770998877", wilayaCode: 9, isDefault: true }),
    ]);
    expect((await agent.get("/api/addresses")).body).toHaveLength(1); // only once

    // Moved, not copied: deleting it doesn't bring it back.
    await agent.delete(`/api/addresses/${res.body[0].id}`).expect(204);
    expect((await agent.get("/api/addresses")).body).toEqual([]);
  });

  it("validates, caps at 10, and keeps each person's addresses private", async () => {
    const { agent } = await loginAs("customer");
    expect((await agent.post("/api/addresses").send({ ...home, phone: "123" })).status).toBe(400);
    for (let i = 0; i < 10; i++) await agent.post("/api/addresses").send({ ...home, label: `A${i}` }).expect(201);
    expect((await agent.post("/api/addresses").send(home)).status).toBe(400);

    const mine = (await agent.get("/api/addresses")).body[0];
    const { agent: other } = await loginAs("customer");
    expect((await other.get("/api/addresses")).body).toEqual([]);
    expect((await other.put(`/api/addresses/${mine.id}`).send({ label: "x" })).status).toBe(404);
    expect((await other.delete(`/api/addresses/${mine.id}`)).status).toBe(404);
    expect((await request(app).get("/api/addresses")).status).toBe(401);
  });
});
