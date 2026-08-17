import "reflect-metadata";
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
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  // host: process.env.DB_HOST || "localhost",
  // port: Number(process.env.DB_PORT) || 5432,
  // username: process.env.DB_USER || "postgres",
  // password: process.env.DB_PASSWORD || "postgres",
  // database: process.env.DB_NAME || "ecom",
  url: process.env.DATABASE_URL,
  ssl: true,
  synchronize: false,
  logging: true,
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
  ],
  migrations: ["src/migrations/*.ts"],
  subscribers: [],
});
