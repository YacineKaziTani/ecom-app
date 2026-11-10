import crypto from "crypto";
import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, placeGuestOrder, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import { Product } from "../src/entities/Product";
import * as chargily from "../src/services/chargily";
import { settleBackgroundTasks } from "../src/utils/background";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const stockOf = async (id: string) =>
  (await AppDataSource.getRepository(Product).findOneByOrFail({ id })).stock;

async function productWithStock(stock: number) {
  const { user } = await loginAs("admin");
  const shop = await createShop(user.id);
  return createProduct(shop.id, { price: 1000, stock });
}

describe("POST /api/payments/create-checkout — access rules", () => {
  // Every case here is rejected before Chargily would be called.
  it("requires the checkout email for a guest order", async () => {
    const product = await productWithStock(5);
    const order = await placeGuestOrder(product.id, 1, { guestEmail: "buyer@example.com" });

    const noEmail = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: order.body.id });
    expect(noEmail.status).toBe(404);

    const wrongEmail = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: order.body.id, email: "someone-else@example.com" });
    expect(wrongEmail.status).toBe(404);
  });

  it("requires the owner to be signed in for an account order", async () => {
    const product = await productWithStock(5);
    const { agent: owner } = await loginAs("customer");
    const order = await owner.post("/api/orders").send({
      ...DELIVERY, shippingAddress: "Constantine",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(order.status).toBe(201);

    const anonymous = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: order.body.id });
    expect(anonymous.status).toBe(401);

    const { agent: stranger } = await loginAs("customer");
    const other = await stranger
      .post("/api/payments/create-checkout")
      .send({ orderId: order.body.id });
    expect(other.status).toBe(404);
  });

  it("rejects cancelled and already-paid orders", async () => {
    const product = await productWithStock(5);
    const cancelled = await placeGuestOrder(product.id, 1, { guestEmail: "c@example.com" });
    await orders().update(cancelled.body.id, { status: "cancelled" });
    const paid = await placeGuestOrder(product.id, 1, { guestEmail: "p@example.com" });
    await orders().update(paid.body.id, { paymentStatus: "paid" });

    const resCancelled = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: cancelled.body.id, email: "c@example.com" });
    expect(resCancelled.status).toBe(400);

    const resPaid = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: paid.body.id, email: "p@example.com" });
    expect(resPaid.status).toBe(400);
  });
});

describe("POST /api/payments/webhook", () => {
  function sendWebhook(type: string, checkoutId: string, signature?: string) {
    const body = JSON.stringify({ type, data: { id: checkoutId } });
    const sig =
      signature ??
      crypto
        .createHmac("sha256", process.env.CHARGILY_API_KEY!)
        .update(body)
        .digest("hex");
    return request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("signature", sig)
      .send(body);
  }

  async function orderAwaitingPayment(stock = 5, quantity = 2) {
    const product = await productWithStock(stock);
    const res = await placeGuestOrder(product.id, quantity);
    const checkoutId = `chk_${crypto.randomUUID()}`;
    await orders().update(res.body.id, { paymentCheckoutId: checkoutId });
    return { product, orderId: res.body.id as string, checkoutId };
  }

  it("rejects a bad signature without touching the order", async () => {
    const { orderId, checkoutId } = await orderAwaitingPayment();
    const res = await sendWebhook("checkout.paid", checkoutId, "00".repeat(32));
    expect(res.status).toBe(403);
    expect((await orders().findOneByOrFail({ id: orderId })).paymentStatus).toBe("unpaid");
  });

  it("marks the order paid, starts fulfilment and drops the reservation deadline", async () => {
    const { orderId, checkoutId } = await orderAwaitingPayment();
    expect((await sendWebhook("checkout.paid", checkoutId)).status).toBe(200);

    const order = await orders().findOneByOrFail({ id: orderId });
    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("processing");
    expect(order.reservedUntil).toBeNull();
  });

  it("never lets a late failure event downgrade a paid order", async () => {
    const { orderId, checkoutId } = await orderAwaitingPayment();
    await sendWebhook("checkout.paid", checkoutId).expect(200);
    await sendWebhook("checkout.failed", checkoutId).expect(200);
    expect((await orders().findOneByOrFail({ id: orderId })).paymentStatus).toBe("paid");
  });

  it("reactivates an order that expired before the payment landed, if stock allows", async () => {
    const { product, orderId, checkoutId } = await orderAwaitingPayment(5, 2);
    // Simulate the expiry job having cancelled it (stock released: 5).
    await AppDataSource.getRepository(Product).update(product.id, { stock: 5 });
    await orders().update(orderId, { status: "cancelled", reservedUntil: null });

    await sendWebhook("checkout.paid", checkoutId).expect(200);

    const order = await orders().findOneByOrFail({ id: orderId });
    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("processing");
    expect(await stockOf(product.id)).toBe(3); // re-reserved
  });

  it("keeps a paid-but-cancelled order cancelled when its stock is gone (refund case)", async () => {
    const { product, orderId, checkoutId } = await orderAwaitingPayment(5, 2);
    await AppDataSource.getRepository(Product).update(product.id, { stock: 0 });
    await orders().update(orderId, { status: "cancelled", reservedUntil: null });

    await sendWebhook("checkout.paid", checkoutId).expect(200);

    const order = await orders().findOneByOrFail({ id: orderId });
    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("cancelled");
    expect(await stockOf(product.id)).toBe(0);
  });

  it("never revives an order the customer cancelled, even if its payment page went through", async () => {
    const expire = jest.spyOn(chargily, "expireChargilyCheckout").mockResolvedValue(true);
    const { product, orderId, checkoutId } = await orderAwaitingPayment(5, 2);
    const email = (await orders().findOneByOrFail({ id: orderId })).guestEmail!;

    await request(app).post(`/api/orders/${orderId}/cancel`).send({ email }).expect(200);
    await settleBackgroundTasks();
    expect(expire).toHaveBeenCalledWith(checkoutId); // the open payment page is closed
    expect(await stockOf(product.id)).toBe(5);

    // ...and if a payment lands anyway, the order stays cancelled for a refund.
    await sendWebhook("checkout.paid", checkoutId).expect(200);
    const order = await orders().findOneByOrFail({ id: orderId });
    expect(order).toMatchObject({ status: "cancelled", paymentStatus: "paid", cancelledBy: "customer" });
    expect(await stockOf(product.id)).toBe(5);
    expire.mockRestore();
  });

  it("acknowledges events for unknown checkouts", async () => {
    expect((await sendWebhook("checkout.paid", "chk_unknown")).status).toBe(200);
  });
});
