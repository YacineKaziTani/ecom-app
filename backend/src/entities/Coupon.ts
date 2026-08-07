import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
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
