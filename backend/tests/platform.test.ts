import request from "supertest";
import { app } from "../src/app";
import { checkEnvironment } from "../src/config/env";
import { initTestDb, closeTestDb } from "./testDb";

describe("checkEnvironment", () => {
  const prodBase = {
    NODE_ENV: "production",
    JWT_SECRET: "x".repeat(48),
    DATABASE_URL: "postgres://user:pass@db.example.com/ecom",
    CLIENT_URL: "https://shop.example.com",
    API_PUBLIC_URL: "https://api.example.com",
    TRUST_PROXY: "2",
    CHARGILY_API_KEY: "live_sk_abc",
    CHARGILY_MODE: "live",
    RESEND_API_KEY: "re_abc",
    CLOUDINARY_CLOUD_NAME: "demo",
  };

  it("accepts a complete production config", () => {
    expect(checkEnvironment(prodBase)).toEqual({ errors: [], warnings: [] });
  });

  it("refuses a short JWT secret in production", () => {
    const { errors } = checkEnvironment({ ...prodBase, JWT_SECRET: "short-secret" });
    expect(errors.join()).toMatch(/JWT_SECRET must be at least 32/);
  });

  it("refuses localhost URLs in production", () => {
    const { errors } = checkEnvironment({
      ...prodBase,
      CLIENT_URL: "http://localhost:5173",
      API_PUBLIC_URL: "http://localhost:4000",
    });
    expect(errors).toHaveLength(2);
  });

  it("warns when an https site runs without NODE_ENV=production", () => {
    const { errors, warnings } = checkEnvironment({ ...prodBase, NODE_ENV: undefined });
    expect(errors).toEqual([]);
    expect(warnings.join()).toMatch(/won't be marked Secure/);
  });

  it("warns about a test key in live mode", () => {
    const { warnings } = checkEnvironment({ ...prodBase, CHARGILY_API_KEY: "test_sk_abc" });
    expect(warnings.join()).toMatch(/test key/);
  });
});

describe("GET /api/health", () => {
  beforeAll(initTestDb);
  afterAll(closeTestDb);

  it("reports the database as up and echoes a request id", async () => {
    const res = await request(app).get("/api/health").set("X-Request-Id", "trace-123");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "up" });
    expect(res.headers["x-request-id"]).toBe("trace-123");
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Not found");
  });
});
