import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Shop } from "../entities/Shop";
import { Category } from "../entities/Category";
import { Product } from "../entities/Product";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { RefreshToken } from "../entities/RefreshToken";
import { Coupon } from "../entities/Coupon";
import { PasswordResetToken } from "../entities/PasswordResetToken";
import { CartItem } from "../entities/CartItem";

const isTest = process.env.NODE_ENV === "test";

// Tests load .env.test themselves (tests/loadEnv.ts). Never fall through to
// .env there: it can hold a real DATABASE_URL, and the test suite TRUNCATEs
// every table between tests.
if (!isTest) dotenv.config();

// DATABASE_URL (e.g. Neon) wins when set; otherwise use the discrete DB_* vars
// (local Postgres, and always for tests).
const databaseUrl = isTest ? undefined : process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: "postgres",
  ...(databaseUrl
    ? { url: databaseUrl, ssl: true }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_NAME || "ecom",
        ssl: process.env.DB_SSL === "true",
      }),
  synchronize: false,
  // Full query logging is opt-in: it's noisy and writes emails / token hashes
  // into the logs.
  logging: process.env.DB_LOGGING === "true" ? true : ["error"],
  entities: [
    User,
    Shop,
    Category,
    Product,
    Order,
    OrderItem,
    RefreshToken,
    Coupon,
    PasswordResetToken,
    CartItem,
  ],
  migrations: [__dirname + "/../migrations/*{.ts,.js}"],
});
