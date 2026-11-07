import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createUser, loginAs } from "./helpers";

beforeAll(async () => {
  await initTestDb();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("POST /api/auth/register", () => {
  it("creates a new customer account and sets auth cookies", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "Password123",
      firstName: "New",
      lastName: "User",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("new@example.com");
    expect(res.body.user.role).toBe("customer");
    expect(res.body.user.password).toBeUndefined(); // never leaks the hash

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c: string) => c.startsWith("token="))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    await createUser({ email: "dup@example.com" });

    const res = await request(app).post("/api/auth/register").send({
      email: "dup@example.com",
      password: "Password123",
      firstName: "A",
      lastName: "B",
    });

    expect(res.status).toBe(409);
  });

  it("rejects a weak password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "weak@example.com",
      password: "short",
      firstName: "A",
      lastName: "B",
    });

    expect(res.status).toBe(400);
  });

  it("strips HTML from names via the sanitization middleware", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "xss@example.com",
      password: "Password123",
      firstName: "<script>alert(1)</script>",
      lastName: "B",
    });

    // The sanitizer strips tags entirely, and the name schema then rejects
    // whatever's left if it's not letters/spaces/hyphens/apostrophes — either
    // way, the raw <script> tag must never reach the database.
    if (res.status === 201) {
      expect(res.body.user.firstName).not.toContain("<script>");
    } else {
      expect(res.status).toBe(400);
    }
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { plainPassword, user } = await createUser({ email: "login@example.com" });

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@example.com");
  });

  it("rejects an incorrect password", async () => {
    const { user } = await createUser({ email: "wrongpass@example.com" });

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "WrongPassword1" });

    expect(res.status).toBe(401);
  });

  it("rejects a nonexistent email without revealing that it doesn't exist", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 with no session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the logged-in user", async () => {
    const { agent, user } = await loginAs("customer", { email: "me@example.com" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new access token and rotates the refresh token", async () => {
    const { agent } = await loginAs("customer", { email: "refresh@example.com" });

    const meBefore = await agent.get("/api/auth/me");
    expect(meBefore.status).toBe(200);

    const refreshRes = await agent.post("/api/auth/refresh");
    expect(refreshRes.status).toBe(200);
    const newCookies = refreshRes.headers["set-cookie"] as unknown as string[];
    expect(newCookies.some((c: string) => c.startsWith("token="))).toBe(true);
    expect(newCookies.some((c: string) => c.startsWith("refreshToken="))).toBe(true);

    // The agent's cookie jar now holds the rotated tokens — subsequent
    // requests should still work seamlessly.
    const meAfter = await agent.get("/api/auth/me");
    expect(meAfter.status).toBe(200);
  });

  it("rejects when there's no refresh token at all", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session so /me subsequently fails", async () => {
    const { agent } = await loginAs("customer", { email: "logout@example.com" });

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
  });
});

describe("role-gated routes", () => {
  it("blocks a customer from listing users", async () => {
    const { agent } = await loginAs("customer");
    const res = await agent.get("/api/auth/users");
    expect(res.status).toBe(403);
  });

  it("allows a super_admin to list users", async () => {
    const { agent } = await loginAs("super_admin");
    const res = await agent.get("/api/auth/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("prevents a super_admin from demoting their own role", async () => {
    const { agent, user } = await loginAs("super_admin");
    const res = await agent.patch(`/api/auth/${user.id}/role`).send({ role: "customer" });
    expect(res.status).toBe(400);
  });
});
