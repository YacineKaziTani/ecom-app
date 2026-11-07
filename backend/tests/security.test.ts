import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createUser, loginAs } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { AuditLog } from "../src/entities/AuditLog";
import { Shop } from "../src/entities/Shop";
import { User } from "../src/entities/User";
import { RefreshToken } from "../src/entities/RefreshToken";
import * as mailer from "../src/services/email";
import { sendVerificationEmail } from "../src/services/emailVerification";
import { base32Decode, base32Encode, totpCode } from "../src/utils/totp";

beforeAll(initTestDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(closeTestDb);

const users = () => AppDataSource.getRepository(User);

describe("TOTP implementation", () => {
  // RFC 6238 Appendix B (SHA-1), last 6 digits.
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("matches the RFC test vector at T=%i", (seconds, expected) => {
    expect(totpCode(secret, seconds * 1000)).toBe(expected);
  });

  it("round-trips base32", () => {
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
});

describe("email verification", () => {
  async function linkTokenFor(user: User) {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    await sendVerificationEmail(user);
    const text = send.mock.calls[0][2].text;
    return /token=([a-f0-9]{64})/.exec(text)![1];
  }

  it("confirms the address with the emailed link, once", async () => {
    const { user } = await createUser({ emailVerifiedAt: null });
    const token = await linkTokenFor(user);

    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(200);
    expect((await users().findOneByOrFail({ id: user.id })).emailVerifiedAt).not.toBeNull();
    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(400);
  });

  it("lets an unverified user ask for a new link", async () => {
    jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent } = await loginAs("customer", { emailVerifiedAt: null });
    expect((await agent.post("/api/auth/resend-verification")).status).toBe(200);

    const { agent: verified } = await loginAs("customer");
    expect((await verified.post("/api/auth/resend-verification")).status).toBe(400);
  });
});

describe("seller applications", () => {
  const application = { shopName: "Poterie de Tlemcen", phone: "0661 22 33 44", message: "Hand-thrown pottery" };

  it("requires a confirmed email", async () => {
    const { agent } = await loginAs("customer", { emailVerifiedAt: null });
    expect((await agent.post("/api/seller-applications").send(application)).status).toBe(403);
  });

  it("goes from pending to an approved shop with an admin owner", async () => {
    jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent, user } = await loginAs("customer");
    const applied = await agent.post("/api/seller-applications").send(application);
    expect(applied.status).toBe(201);
    expect((await agent.post("/api/seller-applications").send(application)).status).toBe(409); // one at a time
    expect((await agent.get("/api/seller-applications/mine")).body.status).toBe("pending");

    const { agent: superAdmin } = await loginAs("super_admin");
    const queue = await superAdmin.get("/api/seller-applications?status=pending");
    expect(queue.body.items).toHaveLength(1);

    const approved = await superAdmin.post(`/api/seller-applications/${applied.body.id}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");

    const shop = await AppDataSource.getRepository(Shop).findOneByOrFail({ ownerId: user.id });
    expect(shop).toMatchObject({ name: "Poterie de Tlemcen", slug: "poterie-de-tlemcen" });
    expect((await users().findOneByOrFail({ id: user.id })).role).toBe("admin");
    // Old sessions still say "customer" — they're revoked so the next sign-in picks up the new role.
    expect(await AppDataSource.getRepository(RefreshToken).count({ where: { userId: user.id } })).toBe(0);

    const log = await AppDataSource.getRepository(AuditLog).findOneByOrFail({ action: "seller_application.approve" });
    expect(log.details).toMatchObject({ shopName: "Poterie de Tlemcen" });
  });

  it("can be rejected with a reason, and can't be reviewed twice", async () => {
    jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent } = await loginAs("customer");
    const applied = await agent.post("/api/seller-applications").send(application);
    const { agent: superAdmin } = await loginAs("super_admin");

    const rejected = await superAdmin.post(`/api/seller-applications/${applied.body.id}/reject`).send({ note: "Please add photos of your work" });
    expect(rejected.body).toMatchObject({ status: "rejected", reviewNote: "Please add photos of your work" });
    expect((await superAdmin.post(`/api/seller-applications/${applied.body.id}/approve`).send({})).status).toBe(409);
  });

  it("isn't for people who already sell", async () => {
    const { agent } = await loginAs("admin");
    expect((await agent.post("/api/seller-applications").send(application)).status).toBe(400);
  });
});

describe("two-factor sign-in", () => {
  async function adminWith2fa() {
    const { agent, user, plainPassword } = await (async () => {
      const created = await createUser({ role: "admin" });
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: created.user.email, password: created.plainPassword }).expect(200);
      return { agent, ...created };
    })();
    const setup = await agent.post("/api/auth/2fa/setup");
    expect(setup.status).toBe(200);
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret: string = setup.body.secret;

    const enabled = await agent.post("/api/auth/2fa/enable").send({ code: totpCode(secret) });
    expect(enabled.status).toBe(200);
    expect(enabled.body.recoveryCodes).toHaveLength(8);
    return { agent, user, plainPassword, secret, recoveryCodes: enabled.body.recoveryCodes as string[] };
  }

  const login = (email: string, password: string) =>
    request(app).post("/api/auth/login").send({ email, password });

  it("asks for a code after the password, then signs in", async () => {
    const { user, plainPassword, secret } = await adminWith2fa();

    const first = await login(user.email, plainPassword);
    expect(first.body).toMatchObject({ twoFactorRequired: true });
    expect(first.headers["set-cookie"]).toBeUndefined(); // no session yet

    const wrong = await request(app).post("/api/auth/login/2fa").send({ challenge: first.body.challenge, code: "000000" });
    expect(wrong.status).toBe(401);

    // Next 30s step: the step used to enable 2FA can't be replayed.
    const ok = await request(app)
      .post("/api/auth/login/2fa")
      .send({ challenge: first.body.challenge, code: totpCode(secret, Date.now() + 30_000) });
    expect(ok.status).toBe(200);
    expect(ok.body.user.totpSecret).toBeUndefined();
    expect(ok.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a replayed code", async () => {
    const { user, plainPassword, secret } = await adminWith2fa();
    const code = totpCode(secret, Date.now() + 30_000);
    const c1 = (await login(user.email, plainPassword)).body.challenge;
    await request(app).post("/api/auth/login/2fa").send({ challenge: c1, code }).expect(200);
    const c2 = (await login(user.email, plainPassword)).body.challenge;
    expect((await request(app).post("/api/auth/login/2fa").send({ challenge: c2, code })).status).toBe(401);
  });

  it("accepts each recovery code exactly once", async () => {
    const { user, plainPassword, recoveryCodes } = await adminWith2fa();
    const c1 = (await login(user.email, plainPassword)).body.challenge;
    await request(app).post("/api/auth/login/2fa").send({ challenge: c1, code: recoveryCodes[0] }).expect(200);
    const c2 = (await login(user.email, plainPassword)).body.challenge;
    expect((await request(app).post("/api/auth/login/2fa").send({ challenge: c2, code: recoveryCodes[0] })).status).toBe(401);
  });

  it("never accepts the challenge as a session", async () => {
    const { user, plainPassword } = await adminWith2fa();
    const { challenge } = (await login(user.email, plainPassword)).body;
    const res = await request(app).get("/api/auth/me").set("Cookie", `token=${challenge}`);
    expect(res.status).toBe(401);
  });

  it("can be turned off with a valid code", async () => {
    const { agent, user, plainPassword, recoveryCodes } = await adminWith2fa();
    expect((await agent.post("/api/auth/2fa/disable").send({ code: "123456" })).status).toBe(400);
    expect((await agent.post("/api/auth/2fa/disable").send({ code: recoveryCodes[1] })).status).toBe(200);
    expect((await login(user.email, plainPassword)).body.user).toBeDefined(); // straight in again
  });

  it("is only for admins", async () => {
    const { agent } = await loginAs("customer");
    expect((await agent.post("/api/auth/2fa/setup")).status).toBe(403);
  });
});

describe("audit log", () => {
  it("records role changes and is readable by super admins only", async () => {
    const { agent: superAdmin } = await loginAs("super_admin");
    const { user } = await createUser();
    await superAdmin.patch(`/api/auth/${user.id}/role`).send({ role: "admin" }).expect(200);

    const res = await superAdmin.get("/api/audit-logs?action=user.role_change");
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ entityId: user.id, details: { from: "customer", to: "admin" } });

    const { agent: admin } = await loginAs("admin");
    expect((await admin.get("/api/audit-logs")).status).toBe(403);
  });
});
