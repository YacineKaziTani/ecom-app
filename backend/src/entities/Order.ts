import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { User } from "./User";
import { OrderItem } from "./OrderItem";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed";

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  // Set when a guest (no account) checks out. Exactly one of userId/guestEmail should be present.
  @Column({ nullable: true })
  guestEmail?: string;

  @Column({ nullable: true })
  guestName?: string; // used to personalize the confirmation email; falls back to "there" if absent

  @Column({ type: "varchar", default: "pending" })
  status!: OrderStatus;

  // Fulfillment status (above) and payment status (below) are deliberately
  // separate state machines — an order can be "pending" fulfillment while
  // "paid", or "processing" while a refund leaves it "failed", etc.
  @Column({ type: "varchar", default: "unpaid" })
  paymentStatus!: PaymentStatus;

  @Column({ nullable: true })
  paymentProvider?: string; // e.g. "chargily" — left generic in case another provider is added later

  // The Chargily checkout id for the most recent payment attempt on this order.
  // Used to match an incoming webhook back to this order. Unique, but note a
  // second "pay now" click overwrites this with a fresh checkout id — the
  // Chargily checkout is treated as ephemeral/single-attempt, same as most
  // hosted-checkout payment gateways (their own checkout links expire too).
  @Column({ nullable: true, unique: true })
  paymentCheckoutId?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal!: number; // sum of line items before any discount

  @Column({ nullable: true })
  couponCode?: string; // the code actually applied, stored uppercase — kept even if the coupon is later deleted/deactivated

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total!: number; // subtotal - discountAmount — this is what's actually charged

  @Column()
  shippingAddress!: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  // Client-supplied key (from the Idempotency-Key request header) that lets a
  // retried checkout request — e.g. after a network timeout, or a double-click
  // that slipped past the disabled button — return the SAME order instead of
  // creating a duplicate. Unique + nullable: Postgres allows multiple NULLs in
  // a unique column, so older/keyless requests are unaffected.
  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date; // bumps whenever status changes — handy for "last updated" in the admin table
}
