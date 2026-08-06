import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Shop } from "./Shop";

export type CouponType = "percentage" | "fixed";

@Entity("coupons")
export class Coupon {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Always stored/matched uppercase so "save10" and "SAVE10" are the same code.
  @Column({ unique: true })
  code!: string;

  @Column({ type: "varchar" })
  type!: CouponType;

  // Percentage: 0-100. Fixed: a currency amount, capped to the order subtotal
  // at apply-time so a coupon can never make a total negative.
  @Column({ type: "decimal", precision: 10, scale: 2 })
  value!: number;

  // Scoped to one shop (only that shop's admin manages it, and it only applies
  // to an order made up entirely of that shop's items) or platform-wide
  // (shopId null — only a super_admin can create these).
  @ManyToOne(() => Shop, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "shopId" })
  shop?: Shop;

  @Column({ nullable: true })
  shopId?: string;

  @Column({ nullable: true })
  minOrderAmount?: number;

  @Column({ nullable: true })
  maxUses?: number;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
