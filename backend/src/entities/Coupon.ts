import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Shop } from "./Shop";

export type CouponType = "percentage" | "fixed";

@Entity("coupons")
export class Coupon {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ type: "varchar" })
  type!: CouponType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  value!: number;

  @ManyToOne(() => Shop, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "shopId" })
  shop?: Shop;

  @Index("IDX_coupons_shopId")
  @Column({ nullable: true })
  shopId?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  minOrderAmount?: number;

  @Column({ nullable: true })
  maxUses?: number;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt?: Date;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
