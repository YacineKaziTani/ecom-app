import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import { User, UserRole } from "../src/entities/User";
import { Shop } from "../src/entities/Shop";
import { Product } from "../src/entities/Product";
import { Coupon, CouponType } from "../src/entities/Coupon";

// Inserts a user directly via the repository (bypassing the API) — fast setup
// for tests that need a pre-existing account but aren't specifically testing
// registration itself.
export async function createUser(overrides: Partial<User> & { password?: string } = {}) {
  const repo = AppDataSource.getRepository(User);
  const plainPassword = overrides.password || "Password123";
  const hashed = await bcrypt.hash(plainPassword, 10);

  const user = repo.create({
    email: overrides.email || `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: hashed,
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "User",
    role: overrides.role || "customer",
    // Verified by default; pass emailVerifiedAt: null to test the unverified path.
    emailVerifiedAt: overrides.emailVerifiedAt === undefined ? new Date() : overrides.emailVerifiedAt,
  });
  await repo.save(user);
  return { user, plainPassword };
}

export async function createShop(ownerId: string, overrides: Partial<Shop> = {}) {
  const repo = AppDataSource.getRepository(Shop);
  const name = overrides.name || `Test Shop ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const shop = repo.create({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    ownerId,
    ...overrides,
  });
  await repo.save(shop);
  return shop;
}

export async function createProduct(shopId: string, overrides: Partial<Product> = {}) {
  const repo = AppDataSource.getRepository(Product);
  const product = repo.create({
    name: overrides.name || `Test Product ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    price: overrides.price ?? 10,
    stock: overrides.stock ?? 10,
    shopId,
    ...overrides,
  });
  await repo.save(product);
  return product;
}

export async function createCoupon(overrides: Partial<Coupon> & { type: CouponType; value: number }) {
  const repo = AppDataSource.getRepository(Coupon);
  const coupon = repo.create({
    code: (overrides.code || `CODE${Date.now()}`).toUpperCase(),
    isActive: true,
    usedCount: 0,
    ...overrides,
  });
  await repo.save(coupon);
  return coupon;
}

// A valid delivery block for checkout payloads (wilaya 16 = Alger, seeded
// with free home delivery by the AddDeliveryAndCod migration).
export const DELIVERY = {
  phone: "0550 12 34 56",
  wilayaCode: 16,
  commune: "Alger Centre",
};

// Places a guest order through the real checkout endpoint.
export function placeGuestOrder(
  productId: string,
  quantity: number,
  extra: {
    couponCode?: string;
    guestEmail?: string;
    paymentMethod?: "card" | "cod";
    wilayaCode?: number;
    deliveryType?: "home" | "desk";
  } = {},
) {
  return request(app)
    .post("/api/orders")
    .send({
      ...DELIVERY, shippingAddress: "12 Rue Larbi Ben M'hidi, Alger",
      guestEmail: extra.guestEmail ?? `guest-${Math.random().toString(36).slice(2)}@example.com`,
      couponCode: extra.couponCode,
      paymentMethod: extra.paymentMethod,
      ...(extra.wilayaCode ? { wilayaCode: extra.wilayaCode } : {}),
      deliveryType: extra.deliveryType,
      items: [{ productId, quantity }],
    });
}

// Logs an agent in via the REAL /api/auth/login endpoint, so its cookie jar
// (access + refresh tokens) matches exactly what a real browser session would
// have. Returns the agent so callers can chain further authenticated requests.
export async function loginAs(role: UserRole = "customer", overrides: Partial<User> = {}) {
  const { user, plainPassword } = await createUser({ role, ...overrides });
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email: user.email, password: plainPassword });
  if (res.status !== 200) {
    throw new Error(`loginAs helper failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user };
}
