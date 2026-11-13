import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Product } from "./Product";
import { ProductVariant } from "./ProductVariant";

// "Tell me when it's back": one email address waiting for a sold-out product
// (or one of its options). Emailed once, when it's in stock again.
//
// One pending alert per (product, option, email) — a partial unique index with
// NULLS NOT DISTINCT (migration AddPromotionsPixelsStockAlerts), which TypeORM
// can't express, so it's excluded from schema sync.
@Entity("stock_alerts")
@Index("UQ_stock_alerts_pending", { synchronize: false })
@Index("IDX_stock_alerts_productId", ["productId"])
export class StockAlert {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Column({ type: "uuid" })
  productId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "variantId" })
  variant?: ProductVariant | null;

  @Column({ type: "uuid", nullable: true })
  variantId!: string | null;

  @Column({ type: "varchar", length: 254 })
  email!: string;

  // The language of the email.
  @Column({ type: "varchar", length: 2, default: "en" })
  locale!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  notifiedAt!: Date | null;
}
