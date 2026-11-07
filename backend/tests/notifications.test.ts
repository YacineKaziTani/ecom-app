import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, placeGuestOrder } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import * as mailer from "../src/services/email";
import * as notifications from "../src/services/notifications";
import { expireUnpaidOrders } from "../src/services/orderLifecycle";
import { orderPlacedEmail } from "../src/emails/orderEmails";

beforeAll(initTestDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);

async function shopWithProduct() {
  const { agent, user } = await loginAs("admin", { email: `owner-${Math.random().toString(36).slice(2)}@example.com` });
  const shop = await createShop(user.id, { name: `Atelier ${Math.random().toString(36).slice(2, 7)}` });
  const product = await createProduct(shop.id, { price: 1500, stock: 10 });
  return { agent, owner: user, product };
}

function mockSend() {
  return jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
}

// Place an order without the route's own background notification, so the
// tests below count exactly the emails they trigger themselves.
async function placeQuietly(...args: Parameters<typeof placeGuestOrder>) {
  const spy = jest.spyOn(notifications, "notifyOrderPlaced").mockResolvedValue();
  try {
    return await placeGuestOrder(...args);
  } finally {
    spy.mockRestore();
  }
}

const sentTo = (spy: jest.SpyInstance) => spy.mock.calls.map(([template, to]) => `${template}:${to}`);

describe("who gets notified", () => {
  it("pay on delivery: the customer and the shop owner hear about a new order right away", async () => {
    const { owner, product } = await shopWithProduct();
    const order = await placeQuietly(product.id, 2, { paymentMethod: "cod", guestEmail: "buyer@example.com" });
    const send = mockSend();

    await notifications.notifyOrderPlaced(order.body.id);
    expect(sentTo(send)).toEqual([
      "order-placed:buyer@example.com",
      `shop-new-order:${owner.email}`,
    ]);
  });

  it("card: shops are only told once the payment lands", async () => {
    const { owner, product } = await shopWithProduct();
    const order = await placeQuietly(product.id, 1, { paymentMethod: "card", guestEmail: "card@example.com" });
    const send = mockSend();

    await notifications.notifyOrderPlaced(order.body.id);
    expect(sentTo(send)).toEqual(["order-placed:card@example.com"]);

    send.mockClear();
    await orders().update(order.body.id, { paymentStatus: "paid", status: "processing" });
    await notifications.notifyOrderPaid(order.body.id);
    expect(sentTo(send)).toEqual([
      "order-status:card@example.com",
      `shop-new-order:${owner.email}`,
    ]);
  });

  it("each shop owner only sees their own lines", async () => {
    const a = await shopWithProduct();
    const b = await shopWithProduct();
    const send = mockSend();
    const order = await placeQuietly(a.product.id, 1, { paymentMethod: "cod" });
    // add a second shop's line directly
    await AppDataSource.query(
      `INSERT INTO order_items ("orderId", "productId", "shopId", "productName", price, quantity) VALUES ($1, $2, $3, 'Other', 900, 1)`,
      [order.body.id, b.product.id, b.product.shopId],
    );
    send.mockClear();

    await notifications.notifyOrderPlaced(order.body.id);
    const shopEmails = send.mock.calls.filter(([template]) => template === "shop-new-order");
    expect(shopEmails).toHaveLength(2);
    const toA = shopEmails.find(([, to]) => to === a.owner.email)!;
    expect(toA[2].text).toContain(a.product.name);
    expect(toA[2].text).not.toContain("Other");
  });

  it("status changes from the dashboard email the customer (and repeats don't)", async () => {
    const { agent, product } = await shopWithProduct();
    const order = await placeQuietly(product.id, 1, { paymentMethod: "cod" });
    const notify = jest.spyOn(notifications, "notifyStatusChange").mockResolvedValue();

    await agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "shipped" }).expect(200);
    await agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "shipped" }).expect(200);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(order.body.id, "shipped");
  });

  it("an expired card order tells the customer why it was cancelled", async () => {
    const { product } = await shopWithProduct();
    const order = await placeQuietly(product.id, 1, { paymentMethod: "card" });
    await orders().update(order.body.id, { reservedUntil: new Date(Date.now() - 1000) });
    const notify = jest.spyOn(notifications, "notifyStatusChange").mockResolvedValue();

    await expireUnpaidOrders();
    expect(notify).toHaveBeenCalledWith(order.body.id, "cancelled", expect.stringMatching(/payment wasn't completed/));
  });

  it("doesn't email for statuses without a message (back to pending)", async () => {
    const { product } = await shopWithProduct();
    const order = await placeQuietly(product.id, 1, { paymentMethod: "cod" });
    const send = mockSend();
    await notifications.notifyStatusChange(order.body.id, "pending");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("email content", () => {
  it("shows DZD amounts, delivery details and the pay-on-delivery note", async () => {
    const { product } = await shopWithProduct();
    const placed = await placeQuietly(product.id, 2, { paymentMethod: "cod" });
    const order = await orders().findOneOrFail({ where: { id: placed.body.id }, relations: ["items"] });

    const email = orderPlacedEmail(order, "Amina", "https://shop.example.com/o/1");
    expect(email.text).toMatch(/3\s000,00\sDA/); // 2 × 1 500 DA
    expect(email.text).toContain("Alger");
    expect(email.text).toMatch(/cash on delivery/);
    expect(email.html).toContain("Amina");
  });
});
