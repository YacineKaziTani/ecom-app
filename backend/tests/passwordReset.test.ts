import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createUser } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { PasswordResetToken } from "../src/entities/PasswordResetToken";
import { createPasswordResetToken } from "../src/services/passwordReset";

beforeAll(async () => {
  await initTestDb();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("POST /api/auth/forgot-password", () => {
  it("responds with the same generic message whether or not the email exists (no enumeration)", async () => {
    await createUser({ email: "exists@example.com" });

    const resExisting = await request(app).post("/api/auth/forgot-password").send({ email: "exists@example.com" });
    const resMissing = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

    expect(resExisting.status).toBe(200);
    expect(resMissing.status).toBe(200);
    expect(resExisting.body.message).toBe(resMissing.body.message);
  });

  it("creates a reset token record for a real user", async () => {
    const { user } = await createUser({ email: "reset@example.com" });

    await request(app).post("/api/auth/forgot-password").send({ email: "reset@example.com" });

    const record = await AppDataSource.getRepository(PasswordResetToken).findOne({ where: { userId: user.id } });
    expect(record).not.toBeNull();
  });

  it("does not create a token for a nonexistent email", async () => {
    await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

    const count = await AppDataSource.getRepository(PasswordResetToken).count();
    expect(count).toBe(0);
  });

  it("invalidates a previous token when a new one is requested (single active token)", async () => {
    const { user } = await createUser({ email: "double@example.com" });

    const firstToken = await createPasswordResetToken(user.id);
    const secondToken = await createPasswordResetToken(user.id);

    // The first token should no longer work — only one reset link is ever live at a time.
    const resFirst = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: firstToken, newPassword: "NewPassword123" });
    expect(resFirst.status).toBe(400);

    const resSecond = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: secondToken, newPassword: "NewPassword123" });
    expect(resSecond.status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password and allows logging in with the new one", async () => {
    const { user } = await createUser({ email: "changeme@example.com", password: "OldPassword123" });
    const rawToken = await createPasswordResetToken(user.id);

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "BrandNewPassword456" });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "changeme@example.com", password: "OldPassword123" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "changeme@example.com", password: "BrandNewPassword456" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a weak new password", async () => {
    const { user } = await createUser();
    const rawToken = await createPasswordResetToken(user.id);

    const res = await request(app).post("/api/auth/reset-password").send({ token: rawToken, newPassword: "weak" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid/garbage token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", newPassword: "NewPassword123" });
    expect(res.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const { user } = await createUser();
    const rawToken = await createPasswordResetToken(user.id);

    // Force the token to look expired, same way the earlier stock/coupon tests
    // manipulate DB state directly to exercise an edge case that's impractical
    // to wait out in real time.
    const repo = AppDataSource.getRepository(PasswordResetToken);
    await repo.update({ userId: user.id }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "NewPassword123" });
    expect(res.status).toBe(400);
  });

  it("is single-use — the same token can't reset the password twice", async () => {
    const { user } = await createUser();
    const rawToken = await createPasswordResetToken(user.id);

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "FirstNewPassword1" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "SecondNewPassword2" });
    expect(second.status).toBe(400);
  });

  it("revokes existing refresh tokens on reset, ending other sessions", async () => {
    const { user, plainPassword } = await createUser({ email: "revoke@example.com" });

    const agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({ email: "revoke@example.com", password: plainPassword });
    expect(loginRes.status).toBe(200);

    // This agent's refresh cookie is valid right now.
    const refreshBefore = await agent.post("/api/auth/refresh");
    expect(refreshBefore.status).toBe(200);

    const rawToken = await createPasswordResetToken(user.id);
    await request(app).post("/api/auth/reset-password").send({ token: rawToken, newPassword: "PostResetPass1" });

    // The old session's refresh token should now be dead.
    const refreshAfter = await agent.post("/api/auth/refresh");
    expect(refreshAfter.status).toBe(401);
  });
});
